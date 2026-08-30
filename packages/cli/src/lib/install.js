import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { checkAgentsHealth, normalizeAgents } from "./agent-health.js";
import {
  copyDirectory,
  copyFile,
  ensureDirectory,
  getExecutablePath,
  getCliPackageRoot,
  getProfileAssetsDir,
  getRuntimeAssetsDir,
  readInstallMetadata,
  removeFinderArtifacts,
  runInstalledScript,
  updateManifestRepoMode,
  writeInstallMetadata
} from "./runtime.js";
import { buildAdoptionArtifacts, ensureV2Scaffolding } from "./specs.js";
import { assertPathsUntracked, beginLocalGitPolicy, finishLocalGitPolicy } from "./git-policy.js";
import { getAdapterOutputPaths } from "./adapter-paths.js";
import { getProjectLayout } from "./project-layout.js";
import { SCHEMA_VERSION, createInstallMetadata, normalizeProfile } from "./profile.js";

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

  if (!path.basename(process.execPath).toLowerCase().startsWith("node")) {
    return getExecutablePath();
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
  const localCliRoot = getProjectLayout(targetRoot).cli;

  if (!fs.existsSync(path.join(cliPackageRoot, "bin", "spectra.js"))) {
    return;
  }

  fs.rmSync(localCliRoot, { recursive: true, force: true });
  ensureDirectory(localCliRoot);

  for (const dirName of ["bin", "src", "assets"]) {
    replaceDirectory(path.join(cliPackageRoot, dirName), path.join(localCliRoot, dirName));
  }
  replaceDirectory(getRuntimeAssetsDir(), path.join(localCliRoot, "assets", "runtime"));
  replaceDirectory(path.dirname(getProfileAssetsDir("lite")), path.join(localCliRoot, "assets", "profiles"));

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
  const launcherDir = getProjectLayout(targetRoot).bin;
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

function writeProjectConfig(targetRoot, { profile, gitMode, overwrite = false }) {
  const configPath = getProjectLayout(targetRoot).config;
  if (fs.existsSync(configPath) && !overwrite) {
    return;
  }
  ensureDirectory(path.dirname(configPath));
  fs.writeFileSync(configPath, `profile: ${profile}\ngitMode: ${gitMode}\nschemaVersion: ${SCHEMA_VERSION}\n`);
}

function installSpectra({ targetDir, adopt = false, agents = "", gitMode = "local", profile = "lite", refresh = false, upgrade = false }) {
  const absoluteTarget = path.resolve(targetDir);
  const normalizedProfile = normalizeProfile(profile);
  const layout = getProjectLayout(absoluteTarget);
  const profileAssetsDir = getProfileAssetsDir(normalizedProfile);
  if (normalizedProfile === "lite" && agents) {
    throw new Error("Agent adapters require --profile full because they create tool integration files outside spectra/.");
  }
  const existingMetadata = readInstallMetadata(absoluteTarget);
  if (!upgrade && existingMetadata?.profile && existingMetadata.profile !== normalizedProfile) {
    throw new Error("profile changes require an explicit upgrade command.");
  }
  if (existingMetadata?.gitMode && existingMetadata.gitMode !== gitMode) {
    throw new Error("Git mode changes require an explicit migration command.");
  }
  const localPolicy = gitMode === "local" ? beginLocalGitPolicy(absoluteTarget) : null;
  const previousMetadata = localPolicy ? readInstallMetadata(absoluteTarget) : null;
  if (localPolicy && agents) {
    assertPathsUntracked(absoluteTarget, getAdapterOutputPaths(agents), "adapter path");
  }

  ensureDirectory(absoluteTarget);

  if (refresh) {
    replaceDirectory(path.join(profileAssetsDir, "sdd", "system"), path.join(layout.sdd, "system"));
    replaceDirectory(path.join(profileAssetsDir, "docs"), layout.docs);
  } else {
    copyDirectory(path.join(profileAssetsDir, "sdd", "system"), path.join(layout.sdd, "system"));
    copyDirectory(path.join(profileAssetsDir, "docs"), layout.docs);
  }

  copyDirectory(path.join(profileAssetsDir, "sdd", "memory-bank"), path.join(layout.sdd, "memory-bank"));
  writeProjectConfig(absoluteTarget, { profile: normalizedProfile, gitMode, overwrite: upgrade });
  updateManifestRepoMode(absoluteTarget, "consumer");
  if (normalizedProfile === "full") {
    ensureV2Scaffolding(layout.root, { adopt });
  }
  const nativeBinaryPath = detectNativeBinaryPath();
  materializeLocalNodeCli(absoluteTarget);
  writeRepoLocalLauncher(absoluteTarget, nativeBinaryPath);
  removeFinderArtifacts(absoluteTarget);
  writeInstallMetadata(absoluteTarget, {
    ...createInstallMetadata({ profile: normalizedProfile, gitMode, installMode: existingMetadata?.installMode ?? (adopt ? "adopt" : "init") }),
    installedAt: new Date().toISOString(),
    binaryPath: nativeBinaryPath,
    localLauncher: "spectra/bin/spectra"
  });

  if (adopt && !refresh) {
    runInstalledScript({
      cwd: absoluteTarget,
      scriptName: "map-codebase.sh",
      args: ["--root", absoluteTarget, "--spectra-root", layout.root]
    });
    if (normalizedProfile === "full") {
      buildAdoptionArtifacts(layout.root);
    }
  }

  if (agents) {
    runInstalledScript({
      cwd: absoluteTarget,
      scriptName: "generate-adapters.sh",
      args: ["--agents", agents, "--target", absoluteTarget]
    });

    const agentHealth = checkAgentsHealth(absoluteTarget, normalizeAgents(agents));
    const unhealthyAgents = agentHealth.filter((result) => !result.healthy);
    if (unhealthyAgents.length > 0) {
      const details = unhealthyAgents
        .map(
          (result) =>
            `${result.displayName}: ${result.checks
              .filter((check) => check.status !== "ok")
              .map((check) => check.detail)
              .join("; ")}`
        )
        .join(" | ");
      throw new Error(`Agent setup is unhealthy: ${details}`);
    }
  }

  let ownedPaths = [];
  let excludePatterns = [];
  if (localPolicy) {
    const localResult = finishLocalGitPolicy(localPolicy, {
      ownedPaths: previousMetadata?.ownedPaths,
      excludePatterns: previousMetadata?.excludePatterns
    });
    ownedPaths = localResult.ownedPaths;
    excludePatterns = localResult.excludePatterns;
    writeInstallMetadata(absoluteTarget, {
      ...createInstallMetadata({ profile: normalizedProfile, gitMode, installMode: existingMetadata?.installMode ?? (adopt ? "adopt" : "init") }),
      installedAt: new Date().toISOString(),
      binaryPath: nativeBinaryPath,
      localLauncher: "spectra/bin/spectra",
      ownedPaths,
      excludePatterns
    });
  }

  return {
    targetDir: absoluteTarget,
    installed: fs.existsSync(layout.installMetadata),
    gitMode,
    ownedPaths,
    excludePatterns
  };
}

export { installSpectra };
