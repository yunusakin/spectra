import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseDocument } from "yaml";
import { checkAgentsHealth, findForeignAdapterFiles, normalizeAgents } from "./agent-health.js";
import {
  copyDirectory,
  copyFile,
  ensureDirectory,
  getExecutablePath,
  getCliPackageRoot,
  getProjectAssetsDir,
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
import { findProjectRoot, getProjectLayout } from "./project-layout.js";
import { SCHEMA_VERSION, createInstallMetadata } from "./install-metadata.js";
import { buildRepoIndex } from "./index/engine.js";
import { writeIndex } from "./index/cache.js";
import { enrichDiscovery } from "./index/discovery.js";
import { parseProjectSummary } from "./context/memory-summaries.js";
import { normalize } from "./business/parser.js";
import { warn } from "./output.js";
import { assertProjectOperationAllowed, inspectProjectCompatibility, MIGRATION_MARKER } from "./project-compatibility.js";
import { inspectApplicationInstallation, resolveStableMachineCommand } from "./application-installation.js";

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

function detectStableMachineCommand(existingMetadata) {
  const installation = inspectApplicationInstallation({ execPath: getExecutablePath() });
  if (installation.kind === "native-managed") return installation.commandPath;
  return resolveStableMachineCommand(existingMetadata?.stableCommandPath);
}

function materializeLocalNodeCli(targetRoot) {
  const cliPackageRoot = getCliPackageRoot();
  const localCliRoot = getProjectLayout(targetRoot).cli;

  if (!fs.existsSync(path.join(cliPackageRoot, "bin", "spectra.js"))) {
    return;
  }

  // A refresh launched from this fallback must not delete its own source files.
  if (fs.existsSync(localCliRoot) && fs.realpathSync(cliPackageRoot) === fs.realpathSync(localCliRoot)) {
    return;
  }

  fs.rmSync(localCliRoot, { recursive: true, force: true });
  ensureDirectory(localCliRoot);

  for (const dirName of ["bin", "src", "assets"]) {
    replaceDirectory(path.join(cliPackageRoot, dirName), path.join(localCliRoot, dirName));
  }
  replaceDirectory(getRuntimeAssetsDir(), path.join(localCliRoot, "assets", "runtime"));
  replaceDirectory(path.dirname(getProjectAssetsDir()), path.join(localCliRoot, "assets", "profiles"));

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

function writeRepoLocalLauncher(targetRoot, nativeBinaryPath, stableCommandPath) {
  const launcherDir = getProjectLayout(targetRoot).bin;
  ensureDirectory(launcherDir);

  const launcherPath = path.join(launcherDir, "spectra");
  const recordedBinary = nativeBinaryPath ? shellQuote(nativeBinaryPath) : "''";
  const recordedStableCommand = stableCommandPath ? shellQuote(stableCommandPath) : "''";
  fs.writeFileSync(
    launcherPath,
    [
      "#!/usr/bin/env sh",
      "set -eu",
      "SCRIPT_DIR=$(CDPATH= cd -P -- \"$(dirname -- \"$0\")\" && pwd -P)",
      "RECORDED_STABLE_COMMAND=" + recordedStableCommand,
      "RECORDED_BINARY=" + recordedBinary,
      "if [ -n \"$RECORDED_STABLE_COMMAND\" ] && [ -x \"$RECORDED_STABLE_COMMAND\" ]; then",
      "  exec \"$RECORDED_STABLE_COMMAND\" \"$@\"",
      "fi",
      "if [ -n \"$RECORDED_BINARY\" ] && [ -x \"$RECORDED_BINARY\" ]; then",
      "  exec \"$RECORDED_BINARY\" \"$@\"",
      "fi",
      "if command -v node >/dev/null 2>&1 && [ -f \"$SCRIPT_DIR/../cli/bin/spectra.js\" ]; then",
      "  exec node \"$SCRIPT_DIR/../cli/bin/spectra.js\" \"$@\"",
      "fi",
      "FOUND_SPECTRA=$(command -v spectra 2>/dev/null || true)",
      "if [ -n \"$FOUND_SPECTRA\" ]; then",
      "  FOUND_DIR=$(CDPATH= cd -P -- \"$(dirname -- \"$FOUND_SPECTRA\")\" && pwd -P)",
      "  FOUND_BASE=$(basename -- \"$FOUND_SPECTRA\")",
      "  SELF_BASE=$(basename -- \"$0\")",
      "  if [ \"$FOUND_DIR/$FOUND_BASE\" != \"$SCRIPT_DIR/$SELF_BASE\" ] && [ \"${SPECTRA_LAUNCHER_CHAINED:-0}\" != 1 ]; then",
      "    SPECTRA_LAUNCHER_CHAINED=1 exec \"$FOUND_SPECTRA\" \"$@\"",
      "  fi",
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

function writeProjectConfig(targetRoot, { gitMode, write = fs.writeFileSync }) {
  const configPath = getProjectLayout(targetRoot).config;
  ensureDirectory(path.dirname(configPath));
  const config = parseDocument(fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "");
  if (config.errors.length) throw config.errors[0];
  config.set("gitMode", gitMode);
  config.set("schemaVersion", SCHEMA_VERSION);
  config.delete("profile");
  write(configPath, config.toString());
}

const migrationRefresh = Symbol("migration refresh");

function installSpectra({
  targetDir,
  adopt = false,
  agents = "",
  gitMode = "local",
  refresh = false,
  refreshMemoryBank = true,
  refreshV2Scaffolding = true,
  [migrationRefresh]: authorizedMigration = false
}) {
  const absoluteTarget = path.resolve(targetDir);
  if (!authorizedMigration) assertProjectOperationAllowed(findProjectRoot(absoluteTarget) ?? absoluteTarget, refresh ? "refresh" : "install");
  if (agents) {
    // Adapters are projections Spectra may regenerate; a same-named file it did
    // not generate is the user's, so refuse before anything is written.
    const foreign = findForeignAdapterFiles(absoluteTarget, normalizeAgents(agents));
    if (foreign.length > 0) {
      throw new Error(
        `Refusing to overwrite existing file(s) not generated by Spectra: ${foreign.join(", ")}. Move them aside, or run "spectra adapters --force" after install.`
      );
    }
  }
  const layout = getProjectLayout(absoluteTarget);
  const profileAssetsDir = getProjectAssetsDir();
  const writeMigrationMetadata = metadata => authorizedMigration ?
    authorizedMigration.writeAuthority(layout.installMetadata, JSON.stringify(metadata, null, 2)) : writeInstallMetadata(absoluteTarget, metadata);

  const existingMetadata = readInstallMetadata(absoluteTarget);
  const docsProjectName = existingMetadata?.docsProjectName ?? (normalize(parseProjectSummary(layout.root).projectName || path.basename(absoluteTarget)) || "project");
  if (typeof docsProjectName !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(docsProjectName)) throw new Error("Invalid project documentation directory name in install metadata.");
  const stableDocsName = docsProjectName === "spectra" ? "spectra-project" : docsProjectName;
  const guidesRoot = path.join(layout.docs, "spectra");
  if (existingMetadata?.gitMode && existingMetadata.gitMode !== gitMode) {
    throw new Error("Git mode changes are not supported. Keep the existing Git mode; spectra migrate preserves it.");
  }
  const localPolicy = gitMode === "local" ? beginLocalGitPolicy(absoluteTarget) : null;
  const previousMetadata = localPolicy ? readInstallMetadata(absoluteTarget) : null;
  if (localPolicy && agents) {
    assertPathsUntracked(absoluteTarget, getAdapterOutputPaths(agents), "adapter path");
  }

  ensureDirectory(absoluteTarget);

  if (refresh) {
    if (authorizedMigration) fs.cpSync(path.join(profileAssetsDir, "sdd", "system"), path.join(layout.sdd, "system"), { recursive: true });
    else replaceDirectory(path.join(profileAssetsDir, "sdd", "system"), path.join(layout.sdd, "system"));
  } else {
    copyDirectory(path.join(profileAssetsDir, "sdd", "system"), path.join(layout.sdd, "system"));
  }

  // Only guides installed by Spectra may be refreshed. A legacy plugin may
  // already occupy the newly reserved directory; preserve those collisions.
  const docsSource = path.join(profileAssetsDir, "docs");
  const ownedGuides = new Set(Array.isArray(existingMetadata?.docsGuidePaths) ? existingMetadata.docsGuidePaths : []);
  const docsGuidePaths = [];
  if (fs.existsSync(docsSource)) {
    for (const relative of fs.readdirSync(docsSource, { recursive: true })) {
      const source = path.join(docsSource, relative);
      if (!fs.statSync(source).isFile()) continue;
      const target = path.join(guidesRoot, relative);
      const exists = fs.existsSync(target);
      if (exists && !ownedGuides.has(relative)) {
        if (!authorizedMigration) warn(`Preserving existing documentation not installed by Spectra: ${target}`);
        continue;
      }
      if (refresh || !exists) {
        ensureDirectory(path.dirname(target));
        fs.copyFileSync(source, target);
      }
      docsGuidePaths.push(relative);
    }
  }

  if (refreshMemoryBank) {
    copyDirectory(path.join(profileAssetsDir, "sdd", "memory-bank"), path.join(layout.sdd, "memory-bank"));
  }
  writeProjectConfig(absoluteTarget, { gitMode, ...(authorizedMigration ? { write: authorizedMigration.writeAuthority } : {}) });
  ensureDirectory(path.join(layout.docs, stableDocsName));
  updateManifestRepoMode(absoluteTarget, "consumer");
  if (refreshV2Scaffolding) {
    ensureV2Scaffolding(layout.root, { adopt });
  }
  const nativeBinaryPath = detectNativeBinaryPath() ?? existingMetadata?.binaryPath ?? null;
  const stableCommandPath = detectStableMachineCommand(existingMetadata);
  materializeLocalNodeCli(absoluteTarget);
  writeRepoLocalLauncher(absoluteTarget, nativeBinaryPath, stableCommandPath);
  removeFinderArtifacts(layout.root);
  const metadata = {
    ...createInstallMetadata({ gitMode, installMode: existingMetadata?.installMode ?? (adopt ? "adopt" : "init"), previous: existingMetadata }),
    binaryPath: nativeBinaryPath,
    stableCommandPath,
    docsProjectName: stableDocsName,
    docsGuidePaths: [...new Set([...(existingMetadata?.docsGuidePaths ?? []), ...docsGuidePaths])],
    localLauncher: ".spectra/bin/spectra"
  };
  writeMigrationMetadata(metadata);

  if (adopt && !refresh) {
    runInstalledScript({
      cwd: absoluteTarget,
      scriptName: "map-codebase.sh",
      args: ["--root", absoluteTarget, "--spectra-root", layout.root],
      strict: true
    });
    let repoIndex = null;
    try {
      repoIndex = buildRepoIndex(absoluteTarget);
      writeIndex(absoluteTarget, repoIndex);
    } catch (error) {
      warn(`Repo indexing failed during adopt: ${error.message}. Run "spectra index" manually once fixed.`);
    }
    enrichDiscovery(absoluteTarget, repoIndex);
    buildAdoptionArtifacts(layout.root);
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
    writeMigrationMetadata({ ...metadata, ownedPaths, excludePatterns });
  }

  return {
    targetDir: absoluteTarget,
    installed: fs.existsSync(layout.installMetadata),
    gitMode,
    ownedPaths,
    excludePatterns
  };
}

function refreshProjectRuntime(projectRoot) {
  assertProjectOperationAllowed(projectRoot, "refresh");
  const metadata = readInstallMetadata(projectRoot);
  return installSpectra({
    targetDir: projectRoot,
    adopt: metadata.installMode === "adopt",
    gitMode: metadata.gitMode ?? "local",
    refresh: true,
    refreshMemoryBank: false,
    refreshV2Scaffolding: false
  });
}

// The executor keeps the marker in place through refresh and policy validation.
// This entry point is limited to its exact root/id/phase and coherent schema 3;
// ordinary install/refresh callers cannot supply the module-private token.
function refreshProjectRuntimeForMigration(projectRoot, migrationId, writeAuthority) {
  const root = fs.realpathSync(projectRoot);
  const markerPath = path.join(root, MIGRATION_MARKER);
  if (fs.lstatSync(markerPath).isSymbolicLink()) throw new Error("Unsafe migration marker symlink.");
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  const compatibility = inspectProjectCompatibility(root);
  if (typeof writeAuthority !== "function" || marker.id !== migrationId || marker.projectRoot !== root || marker.phase !== "refresh" ||
      compatibility.sourceRepository || compatibility.layout !== "canonical" || compatibility.projectSchemaVersion !== SCHEMA_VERSION ||
      compatibility.conflicts.some(conflict => conflict !== `Incomplete migration marker: ${MIGRATION_MARKER}`)) throw new Error("Unauthorized migration runtime refresh.");
  const metadata = readInstallMetadata(root);
  return installSpectra({ targetDir: root, adopt: metadata.installMode === "adopt", gitMode: metadata.gitMode ?? "shared",
    refresh: true, refreshMemoryBank: false, refreshV2Scaffolding: false, [migrationRefresh]: { writeAuthority } });
}

export { installSpectra, refreshProjectRuntime, refreshProjectRuntimeForMigration };
