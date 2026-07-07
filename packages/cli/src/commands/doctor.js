import path from "node:path";
import { checkCodexHealth } from "../lib/codex-health.js";
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

    const codexHealth = checkCodexHealth(repoRoot);
    if (!codexHealth.detected) {
      warn("Codex: not configured (AGENTS.md is missing)");
    } else if (codexHealth.healthy) {
      ok("Codex: healthy");
    } else {
      fail("Codex: unhealthy");
      for (const check of codexHealth.checks) {
        if (check.status !== "ok" && check.status !== "skipped") {
          fail(`Codex ${check.name}: ${check.detail}`);
        }
      }
      hasFailure = true;
    }
  } else {
    warn(`No Spectra runtime found from ${startDir}`);
  }

  return hasFailure ? 1 : 0;
}

export { doctorCommand };
