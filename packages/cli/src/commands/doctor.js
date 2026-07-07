import path from "node:path";
import { AGENT_DEFINITIONS, checkAgentsHealth } from "../lib/agent-health.js";
import { findSpectraRoot, getRuntimeAssetsDir, hasCommand } from "../lib/runtime.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function doctorCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd"]
  });

  if (options["--help"]) {
    title("Usage: spectra doctor [--cwd <path>]");
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
  } else {
    warn(`No Spectra runtime found from ${startDir}`);
  }

  return hasFailure ? 1 : 0;
}

export { doctorCommand };
