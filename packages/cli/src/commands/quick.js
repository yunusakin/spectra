import { runInstalledScript } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function quickCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--type", "--task"]
  });

  if (options["--help"]) {
    title("Usage: spectra quick --type <docs|rules|spec|ops> --task <description> [--cwd <path>]");
    return 0;
  }

  for (const flag of ["--type", "--task"]) {
    if (!options[flag]) {
      throw new Error(`Missing required flag: ${flag}`);
    }
  }

  return runInstalledScript({
    cwd: options["--cwd"] ?? process.cwd(),
    scriptName: "quick.sh",
    args: ["--type", options["--type"], "--task", options["--task"]]
  });
}

export { quickCommand };
