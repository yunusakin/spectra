import path from "node:path";
import { checkCodexHealth } from "../lib/codex-health.js";
import { runInstalledScript } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function includesAgent(agents, expectedAgent) {
  return agents
    .split(",")
    .map((agent) => agent.trim())
    .filter(Boolean)
    .includes(expectedAgent);
}

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

  if (status === 0 && includesAgent(options["--agents"], "codex")) {
    const codexHealth = checkCodexHealth(targetDir);
    if (!codexHealth.healthy) {
      const details = codexHealth.checks
        .filter((check) => check.status !== "ok" && check.status !== "skipped")
        .map((check) => check.detail)
        .join("; ");
      throw new Error(`Codex setup is unhealthy: ${details}`);
    }
  }

  return status;
}

export { adaptersGenerateCommand };
