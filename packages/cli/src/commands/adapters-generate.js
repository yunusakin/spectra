import path from "node:path";
import { checkAgentsHealth, normalizeAgents } from "../lib/agent-health.js";
import { runInstalledScript } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function adaptersGenerateCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--agents", "--target"]
  });

  if (options["--help"]) {
    title("Usage: spectra adapters --agents <csv> [--cwd <path>] [--target <path>]");
    return 0;
  }

  if (!options["--agents"]) {
    throw new Error("Missing required flag: --agents");
  }

  const targetDir = path.resolve(options["--target"] ?? options["--cwd"] ?? process.cwd());
  const status = runInstalledScript({
    cwd: options["--cwd"] ?? process.cwd(),
    scriptName: "generate-adapters.sh",
    args: [
      "--agents",
      options["--agents"],
      "--target",
      targetDir
    ]
  });

  if (status === 0) {
    const agentHealth = checkAgentsHealth(targetDir, normalizeAgents(options["--agents"]));
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

  return status;
}

export { adaptersGenerateCommand };
