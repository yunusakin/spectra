import path from "node:path";
import { AGENT_DEFINITIONS, checkAgentsHealth, findForeignAdapterFiles } from "../lib/agent-health.js";
import { installSpectra } from "../lib/install.js";
import { ensureLocalSpectraExclude } from "../lib/git-policy.js";
import { validateBusinessContext } from "../lib/business-context.js";
import { validateCommand } from "./validate.js";
import {
  findSpectraRoot,
  getRuntimeAssetsDir,
  hasCommand,
  isNativeRuntime,
  readInstallMetadata,
  runInstalledScript,
  writeInstallMetadata
} from "../lib/runtime.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { createInstallMetadata } from "../lib/install-metadata.js";
import { assertProjectOperationAllowed, inspectProjectCompatibility } from "../lib/project-compatibility.js";

function detectGitMode(repoRoot) {
  const metadata = readInstallMetadata(repoRoot);
  if (metadata?.gitMode === "local" || metadata?.gitMode === "shared") {
    return metadata.gitMode;
  }
  return "local";
}

function mergeMetadata(repoRoot, { gitMode, excludePatterns = null }) {
  const current = readInstallMetadata(repoRoot) ?? {};
  writeInstallMetadata(repoRoot, {
    ...current,
    ...createInstallMetadata({
      gitMode,
      installMode: current.installMode ?? "doctor-fix"
    }),
    installedAt: current.installedAt ?? new Date().toISOString(),
    ...(current.binaryPath ? { binaryPath: current.binaryPath } : {}),
    localLauncher: current.localLauncher ?? ".spectra/bin/spectra",
    ...(excludePatterns ? { excludePatterns: [...new Set([...(current.excludePatterns ?? []), ...excludePatterns])].sort() } : {})
  });
}

function runFix(repoRoot) {
  const gitMode = detectGitMode(repoRoot);
  const fixed = [];

  installSpectra({
    targetDir: repoRoot,
    gitMode,
    refresh: true,
    refreshMemoryBank: false,
    refreshV2Scaffolding: false
  });
  fixed.push("refreshed generated runtime, docs, system files, launcher, and install metadata");

  if (gitMode === "local") {
    const exclude = ensureLocalSpectraExclude(repoRoot);
    mergeMetadata(repoRoot, { gitMode, excludePatterns: exclude.excludePatterns });
    if (exclude.changed) {
      fixed.push("restored local Git exclude policy for /.spectra/");
    }
  } else {
    mergeMetadata(repoRoot, { gitMode });
  }

  const repairableAdapters = checkAgentsHealth(repoRoot, Object.keys(AGENT_DEFINITIONS))
    .filter((agentResult) => agentResult.detected)
    .filter((agentResult) => {
      const adapterFiles = new Set(AGENT_DEFINITIONS[agentResult.agent].files.map((entry) => entry.path));
      return agentResult.checks.some((check) => adapterFiles.has(check.name) && check.status === "missing");
    })
    .filter((agentResult) => {
      const definition = AGENT_DEFINITIONS[agentResult.agent];
      return !definition.cliCommand || hasCommand(definition.cliCommand());
    })
    .map((agentResult) => agentResult.agent)
    .filter((agent) => {
      const foreign = findForeignAdapterFiles(repoRoot, [agent]);
      if (foreign.length) warn(`Skipping adapter repair for ${agent}: user-owned files (${foreign.join(", ")}).`);
      return foreign.length === 0;
    });

  if (repairableAdapters.length > 0) {
    const status = runInstalledScript({
      cwd: repoRoot,
      scriptName: "generate-adapters.sh",
      args: ["--agents", repairableAdapters.join(","), "--target", repoRoot]
    });
    if (status !== 0) {
      throw new Error(`adapter repair failed for ${repairableAdapters.join(",")}`);
    }
    fixed.push(`refreshed generated adapter files for ${repairableAdapters.join(",")}`);
  }

  for (const message of fixed) {
    title(`✓ Fixed: ${message}`);
  }
}

function printAgentHealth(repoRoot) {
  let hasFailure = false;
  const agentResults = checkAgentsHealth(repoRoot, Object.keys(AGENT_DEFINITIONS));
  for (const agentResult of agentResults) {
    if (!agentResult.detected) {
      warn(`${agentResult.displayName}: not configured`);
    } else if (agentResult.healthy) {
      ok(`${agentResult.displayName}: healthy`);
    } else {
      fail(`${agentResult.displayName}: unhealthy`);
      for (const check of agentResult.checks) {
        if (check.status !== "ok") {
          fail(`${agentResult.displayName} ${check.name}: ${check.detail}`);
        }
      }
      hasFailure = true;
    }
  }
  return hasFailure;
}

function doctorCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--fix"],
    stringFlags: ["--cwd"]
  });

  if (options["--help"]) {
    title("Usage: spectra doctor [--fix] [--cwd <path>]");
    return 0;
  }

  let hasFailure = false;

  // A native binary bundles its own Node runtime, so node on PATH is only
  // required when the CLI itself is running under Node.
  const requiredCommands = isNativeRuntime() ? ["bash", "git"] : ["bash", "git", "node"];
  for (const commandName of requiredCommands) {
    if (hasCommand(commandName)) {
      ok(`${commandName} is available`);
    } else {
      fail(`${commandName} is missing from PATH`);
      hasFailure = true;
    }
  }

  const startDir = options["--cwd"] ?? process.cwd();
  const repoRoot = findSpectraRoot(startDir);

  if (repoRoot) {
    const compatibility = options["--fix"] ? assertProjectOperationAllowed(repoRoot, "doctor-fix") : inspectProjectCompatibility(repoRoot);
    if (compatibility.status !== "CURRENT") {
      title(`Compatibility: ${compatibility.status}`);
      title(`Application: ${compatibility.applicationVersion}; project schema: ${compatibility.projectSchemaVersion ?? "unknown"}; readable schema: ${compatibility.minimumReadableSchema}-${compatibility.maximumReadableSchema}`);
      title(compatibility.reason);
      return 1;
    }
    ok(`Spectra runtime found at ${repoRoot}`);
    ok(`Packaged runtime scripts resolved from ${path.join(getRuntimeAssetsDir(), "scripts")}`);

    if (options["--fix"]) {
      try {
        runFix(repoRoot);
      } catch (error) {
        fail(`Doctor fix failed: ${error.message}`);
        return 1;
      }

      const businessErrors = validateBusinessContext(repoRoot);
      if (businessErrors.length > 0) {
        for (const error of businessErrors) {
          title(`⚠ Manual action required: ${error}`);
        }
        return 1;
      }

      if (printAgentHealth(repoRoot)) {
        return 1;
      }

      return validateCommand(["--cwd", repoRoot]);
    }

    hasFailure = printAgentHealth(repoRoot) || hasFailure;
  } else {
    warn(`No Spectra runtime found from ${startDir}`);
  }

  return hasFailure ? 1 : 0;
}

export { doctorCommand };
