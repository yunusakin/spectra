import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getProjectLayout } from "./project-layout.js";

function getExecutablePath() {
  try {
    return fs.realpathSync(process.execPath);
  } catch {
    return process.execPath;
  }
}

const moduleDir =
  typeof import.meta.url === "string" ? path.dirname(fileURLToPath(import.meta.url)) : path.dirname(getExecutablePath());
const packageRoot = path.resolve(moduleDir, "..", "..");

function resolveAssetDir(localRelativePath, devFallbackRelativePath) {
  const nativeAssetsRoot = process.env.SPECTRA_ASSETS_DIR;
  if (nativeAssetsRoot) {
    const nativePath = path.join(nativeAssetsRoot, path.basename(localRelativePath));
    if (fs.existsSync(nativePath)) {
      return nativePath;
    }
  }

  const binaryAssetCandidates = [
    path.resolve(path.dirname(process.execPath), "..", localRelativePath),
    path.resolve(path.dirname(getExecutablePath()), "..", localRelativePath)
  ];
  for (const binaryRelativePath of binaryAssetCandidates) {
    if (fs.existsSync(binaryRelativePath)) {
      return binaryRelativePath;
    }
  }

  const localPath = path.join(packageRoot, localRelativePath);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return path.resolve(packageRoot, devFallbackRelativePath);
}

const runtimeDir = resolveAssetDir(path.join("assets", "runtime"), path.join("..", "..", "core", "assets", "runtime"));
const baseTemplateDir = resolveAssetDir(path.join("assets", "base"), path.join("..", "..", "templates", "assets", "base"));
const profilesDir = resolveAssetDir(path.join("assets", "profiles"), path.join("..", "..", "profiles"));

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  ensureDirectory(targetDir);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (!fs.existsSync(targetPath)) {
      ensureDirectory(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyFile(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return;
  }

  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function mergeGitignore(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  if (!fs.existsSync(targetPath)) {
    copyFile(sourcePath, targetPath);
    return;
  }

  const current = new Set(fs.readFileSync(targetPath, "utf8").split(/\r?\n/));
  const additions = fs
    .readFileSync(sourcePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.startsWith("#") && !current.has(line));

  if (additions.length > 0) {
    const prefix = fs.readFileSync(targetPath, "utf8").endsWith("\n") ? "" : "\n";
    fs.appendFileSync(targetPath, `${prefix}${additions.join("\n")}\n`);
  }
}

function updateManifestRepoMode(targetRoot, repoMode) {
  const canonicalManifestPath = path.join(getProjectLayout(targetRoot).sdd, "system", "manifest.env");
  const manifestPath = fs.existsSync(canonicalManifestPath)
    ? canonicalManifestPath
    : path.join(targetRoot, "sdd", "system", "manifest.env");

  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const content = fs.readFileSync(manifestPath, "utf8");
  const next = content.replace(/^repo_mode=.*$/m, `repo_mode=${repoMode}`);
  fs.writeFileSync(manifestPath, next);
}

function writeInstallMetadata(targetRoot, metadata) {
  const metadataPath = getProjectLayout(targetRoot).installMetadata;
  ensureDirectory(path.dirname(metadataPath));
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

function readInstallMetadata(targetRoot) {
  const metadataPaths = [
    getProjectLayout(targetRoot).installMetadata,
    path.join(targetRoot, ".spectra", "install.json")
  ];
  for (const metadataPath of metadataPaths) {
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    }
  }
  return null;
}

function getInstalledProfile(targetRoot) {
  const metadata = readInstallMetadata(targetRoot);
  if (metadata?.profile === "lite" || metadata?.profile === "full") {
    return metadata.profile;
  }

  const canonicalManifestPath = path.join(getProjectLayout(targetRoot).sdd, "system", "manifest.env");
  return fs.existsSync(canonicalManifestPath) ? "lite" : "full";
}

function findSpectraRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const canonicalManifestPath = path.join(getProjectLayout(current).sdd, "system", "manifest.env");
    const nestedCanonicalManifestPath = path.join(current, "sdd", "system", "manifest.env");
    const nestedCanonicalMetadataPath = path.join(current, "install.json");
    const manifestPath = fs.existsSync(canonicalManifestPath)
      ? canonicalManifestPath
      : path.join(current, "sdd", "system", "manifest.env");

    if (fs.existsSync(manifestPath)) {
      if (fs.existsSync(nestedCanonicalManifestPath) && fs.existsSync(nestedCanonicalMetadataPath)) {
        return path.dirname(current);
      }
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function runInstalledScript({ cwd, scriptName, args = [] }) {
  const repoRoot = findSpectraRoot(cwd);

  if (!repoRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }

  const scriptPath = path.join(runtimeDir, "scripts", scriptName);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Missing installed script: ${scriptPath}`);
  }

  const spectraRoot = getProjectLayout(repoRoot).root;
  const isCanonicalLayout = fs.existsSync(path.join(spectraRoot, "sdd", "system", "manifest.env"));

  const result = spawnSync("bash", [scriptPath, ...args], {
    cwd: isCanonicalLayout ? spectraRoot : repoRoot,
    env: {
      ...process.env,
      SPECTRA_REPO_ROOT: isCanonicalLayout ? spectraRoot : repoRoot,
      SPECTRA_PROJECT_ROOT: repoRoot,
      SPECTRA_RUNTIME_ROOT: runtimeDir
    },
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function removeFinderArtifacts(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.name === ".DS_Store") {
      fs.rmSync(entryPath, { force: true });
      continue;
    }

    if (entry.isDirectory()) {
      removeFinderArtifacts(entryPath);
    }
  }
}

function hasCommand(commandName) {
  const result = spawnSync("bash", ["-lc", `command -v ${commandName}`], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function getRuntimeAssetsDir() {
  return runtimeDir;
}

function getBaseTemplateDir() {
  return baseTemplateDir;
}

function getProfileAssetsDir(profile) {
  return path.join(profilesDir, profile);
}

function getCliPackageRoot() {
  return packageRoot;
}

export {
  copyDirectory,
  copyFile,
  ensureDirectory,
  findSpectraRoot,
  getInstalledProfile,
  getBaseTemplateDir,
  getProfileAssetsDir,
  getCliPackageRoot,
  getExecutablePath,
  getRuntimeAssetsDir,
  hasCommand,
  mergeGitignore,
  removeFinderArtifacts,
  readInstallMetadata,
  runInstalledScript,
  updateManifestRepoMode,
  writeInstallMetadata
};
