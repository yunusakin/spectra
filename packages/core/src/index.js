import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(packageRoot, "assets", "runtime");

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
  const manifestPath = path.join(targetRoot, "sdd", "system", "manifest.env");

  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const content = fs.readFileSync(manifestPath, "utf8");
  const next = content.replace(/^repo_mode=.*$/m, `repo_mode=${repoMode}`);
  fs.writeFileSync(manifestPath, next);
}

function writeInstallMetadata(targetRoot, metadata) {
  const installDir = path.join(targetRoot, ".spectra");
  ensureDirectory(installDir);
  fs.writeFileSync(path.join(installDir, "install.json"), JSON.stringify(metadata, null, 2));
}

function findSpectraRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const manifestPath = path.join(current, "sdd", "system", "manifest.env");

    if (fs.existsSync(manifestPath)) {
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

  const result = spawnSync("bash", [scriptPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SPECTRA_REPO_ROOT: repoRoot,
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

export {
  copyDirectory,
  copyFile,
  ensureDirectory,
  findSpectraRoot,
  getRuntimeAssetsDir,
  hasCommand,
  mergeGitignore,
  removeFinderArtifacts,
  runInstalledScript,
  updateManifestRepoMode,
  writeInstallMetadata
};
