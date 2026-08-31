import path from "node:path";
import { AGENT_DEFINITIONS, checkAgentsHealth } from "../lib/agent-health.js";
import { installSpectra } from "../lib/install.js";
import { ensureLocalSpectraExclude } from "../lib/git-policy.js";
import { validateBusinessContext } from "../lib/business-context.js";
import { validateCommand } from "./validate.js";
import {
  findSpectraRoot,
  getInstalledProfile,
  getRuntimeAssetsDir,
  hasCommand,
  readInstallMetadata,
  runInstalledScript,
  writeInstallMetadata
} from "../lib/runtime.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { createInstallMetadata } from "../lib/profile.js";

function detectGitMode(repoRoot) {
  const metadata = readInstallMetadata(repoRoot);
  if (metadata?.gitMode === "local" || metadata?.gitMode === "shared") {
    return metadata.gitMode;
  }
  return "local";
}

function mergeMetadata(repoRoot, { profile, gitMode, excludePatterns = null }) {
  const current = readInstallMetadata(repoRoot) ?? {};
  writeInstallMetadata(repoRoot, {
    ...current,
    ...createInstallMetadata({
      profile,
      gitMode,
      installMode: current.installMode ?? "doctor-fix"
    }),
    installedAt: current.installedAt ?? new Date().toISOString(),
    ...(current.binaryPath ? { binaryPath: current.binaryPath } : {}),
    localLauncher: current.localLauncher ?? "spectra/bin/spectra",
    ...(excludePatterns ? { excludePatterns: [...new Set([...(current.excludePatterns ?? []), ...excludePatterns])].sort() } : {})
  });
}

function runFix(repoRoot) {
  const profile = getInstalledProfile(repoRoot);
  const gitMode = detectGitMode(repoRoot);
  const fixed = [];

  installSpectra({
    targetDir: repoRoot,
    profile,
    gitMode,
    refresh: true,
    refreshMemoryBank: false,
    refreshV2Scaffolding: false
  });
  fixed.push("refreshed generated runtime, profile docs, system files, launcher, and install metadata");

  if (gitMode === "local") {
    const exclude = ensureLocalSpectraExclude(repoRoot);
    mergeMetadata(repoRoot, { profile, gitMode, excludePatterns: exclude.excludePatterns });
    if (exclude.changed) {
      fixed.push("restored local Git exclude policy for /spectra/");
    }
  } else {
    mergeMetadata(repoRoot, { profile, gitMode });
  }

  const repairableAdapters = checkAgentsHealth(repoRoot, Object.keys(AGENT_DEFINITIONS))
    .filter((agentResult) => agentResult.detected)
    .filter((agentResult) => {
      const adapterFiles = new Set(AGENT_DEFINITIONS[agentResult.agent].files.map((entry) => entry.path));
      return agentResult.checks.some((check) => adapterFiles.has(check.name) && ["missing", "invalid"].includes(check.status));
    })
    .filter((agentResult) => {
      const definition = AGENT_DEFINITIONS[agentResult.agent];
      return !definition.cliCommand || hasCommand(definition.cliCommand());
    })
    .map((agentResult) => agentResult.agent);

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

  for (const commandName of ["bash", "git", "node"]) {
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

    hasFailure = printAgentHealth(repoRoot);
  } else {
    warn(`No Spectra runtime found from ${startDir}`);
  }

  return hasFailure ? 1 : 0;
}

export { doctorCommand };
