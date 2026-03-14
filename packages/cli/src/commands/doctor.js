import path from "node:path";
import { findSpectraRoot, getRuntimeAssetsDir, hasCommand } from "@spectra/core";
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
  } else {
    warn(`No Spectra runtime found from ${startDir}`);
  }

  return hasFailure ? 1 : 0;
}

export { doctorCommand };
