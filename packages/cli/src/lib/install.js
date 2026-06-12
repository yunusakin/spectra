import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  copyDirectory,
  copyFile,
  ensureDirectory,
  getExecutablePath,
  getCliPackageRoot,
  getRuntimeAssetsDir,
  mergeGitignore,
  removeFinderArtifacts,
  runInstalledScript,
  updateManifestRepoMode,
  writeInstallMetadata
} from "./runtime.js";
import { getBaseTemplateDir } from "./runtime.js";
import { buildAdoptionArtifacts, ensureV2Scaffolding } from "./specs.js";

function replaceDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  copyDirectory(sourceDir, targetDir);
}

function detectNativeBinaryPath() {
  if (process.env.SPECTRA_BINARY_PATH && fs.existsSync(process.env.SPECTRA_BINARY_PATH)) {
    return process.env.SPECTRA_BINARY_PATH;
  }

  try {
    const requireFromCli = createRequire(path.join(getCliPackageRoot(), "package.json"));
    const sea = requireFromCli("node:sea");
    if (sea.isSea()) {
      return getExecutablePath();
    }
  } catch {
    // node:sea is optional for npm installs and older Node runtimes.
  }

  return null;
}

function materializeLocalNodeCli(targetRoot) {
  const cliPackageRoot = getCliPackageRoot();
  const localCliRoot = path.join(targetRoot, ".spectra", "cli");

  if (!fs.existsSync(path.join(cliPackageRoot, "bin", "spectra.js"))) {
    return;
  }

  fs.rmSync(localCliRoot, { recursive: true, force: true });
  ensureDirectory(localCliRoot);

  for (const dirName of ["bin", "src", "assets"]) {
    replaceDirectory(path.join(cliPackageRoot, dirName), path.join(localCliRoot, dirName));
  }

  for (const fileName of ["package.json", "README.md", "LICENSE"]) {
    copyFile(path.join(cliPackageRoot, fileName), path.join(localCliRoot, fileName));
  }

  try {
    const requireFromCli = createRequire(path.join(cliPackageRoot, "package.json"));
    const yamlPackageDir = path.dirname(requireFromCli.resolve("yaml/package.json"));
    replaceDirectory(yamlPackageDir, path.join(localCliRoot, "node_modules", "yaml"));
  } catch {
    // Native installs do not need the local Node fallback.
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function writeRepoLocalLauncher(targetRoot, nativeBinaryPath) {
  const launcherDir = path.join(targetRoot, ".spectra", "bin");
  ensureDirectory(launcherDir);

  const launcherPath = path.join(launcherDir, "spectra");
  const recordedBinary = nativeBinaryPath ? shellQuote(nativeBinaryPath) : "''";
  fs.writeFileSync(
    launcherPath,
    [
      "#!/usr/bin/env sh",
      "set -eu",
      "SCRIPT_DIR=$(CDPATH= cd -- \"$(dirname -- \"$0\")\" && pwd)",
      "RECORDED_BINARY=" + recordedBinary,
      "if [ -n \"$RECORDED_BINARY\" ] && [ -x \"$RECORDED_BINARY\" ]; then",
      "  exec \"$RECORDED_BINARY\" \"$@\"",
      "fi",
      "if command -v node >/dev/null 2>&1 && [ -f \"$SCRIPT_DIR/../cli/bin/spectra.js\" ]; then",
      "  exec node \"$SCRIPT_DIR/../cli/bin/spectra.js\" \"$@\"",
      "fi",
      "FOUND_SPECTRA=$(command -v spectra 2>/dev/null || true)",
      "if [ -n \"$FOUND_SPECTRA\" ] && [ \"$FOUND_SPECTRA\" != \"$SCRIPT_DIR/spectra\" ]; then",
      "  exec \"$FOUND_SPECTRA\" \"$@\"",
      "fi",
      "echo \"Spectra launcher could not find a native binary, local Node CLI, or spectra on PATH.\" >&2",
      "exit 127",
      ""
    ].join("\n")
  );
  fs.chmodSync(launcherPath, 0o755);

  fs.writeFileSync(
    path.join(launcherDir, "spectra.cmd"),
    [
      "@echo off",
      "set SCRIPT_DIR=%~dp0",
      "if exist \"%SCRIPT_DIR%..\\cli\\bin\\spectra.js\" node \"%SCRIPT_DIR%..\\cli\\bin\\spectra.js\" %*",
      ""
    ].join("\r\n")
  );
}

function installSpectra({ targetDir, adopt = false, agents = "" }) {
  const absoluteTarget = path.resolve(targetDir);
  const runtimeDir = getRuntimeAssetsDir();
  const templateDir = getBaseTemplateDir();

  ensureDirectory(absoluteTarget);

  copyDirectory(path.join(runtimeDir, "sdd", "system"), path.join(absoluteTarget, "sdd", "system"));

  copyDirectory(path.join(templateDir, "sdd", "memory-bank"), path.join(absoluteTarget, "sdd", "memory-bank"));
  copyDirectory(path.join(templateDir, "docs"), path.join(absoluteTarget, "docs"));
  copyDirectory(path.join(templateDir, ".github"), path.join(absoluteTarget, ".github"));
  copyDirectory(path.join(templateDir, "app"), path.join(absoluteTarget, "app"));

  for (const fileName of [".editorconfig", "CHANGELOG.md", "RELEASE_SUMMARY.md", "LICENSE"]) {
    copyFile(path.join(templateDir, fileName), path.join(absoluteTarget, fileName));
  }

  mergeGitignore(path.join(templateDir, ".gitignore"), path.join(absoluteTarget, ".gitignore"));
  updateManifestRepoMode(absoluteTarget, "consumer");
  ensureV2Scaffolding(absoluteTarget, { adopt });
  const nativeBinaryPath = detectNativeBinaryPath();
  materializeLocalNodeCli(absoluteTarget);
  writeRepoLocalLauncher(absoluteTarget, nativeBinaryPath);
  removeFinderArtifacts(absoluteTarget);
  writeInstallMetadata(absoluteTarget, {
    installedAt: new Date().toISOString(),
    installMode: adopt ? "adopt" : "init",
    binaryPath: nativeBinaryPath,
    localLauncher: ".spectra/bin/spectra"
  });

  if (adopt) {
    runInstalledScript({
      cwd: absoluteTarget,
      scriptName: "map-codebase.sh",
      args: ["--root", absoluteTarget]
    });
    buildAdoptionArtifacts(absoluteTarget);
  }

  if (agents) {
    runInstalledScript({
      cwd: absoluteTarget,
      scriptName: "generate-adapters.sh",
      args: ["--agents", agents, "--target", absoluteTarget]
    });
  }

  return {
    targetDir: absoluteTarget,
    installed: fs.existsSync(path.join(absoluteTarget, ".spectra", "install.json"))
  };
}

export { installSpectra };
