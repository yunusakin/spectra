import { runInstalledScript } from "@spectra/core";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function discussTaskCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--item", "--task-type", "--goal"]
  });

  if (options["--help"]) {
    title("Usage: spectra task --item <id> --task-type <type> --goal <text> [--cwd <path>]");
    return 0;
  }

  for (const flag of ["--item", "--task-type", "--goal"]) {
    if (!options[flag]) {
      throw new Error(`Missing required flag: ${flag}`);
    }
  }

  return runInstalledScript({
    cwd: options["--cwd"] ?? process.cwd(),
    scriptName: "discuss-task.sh",
    args: ["--item", options["--item"], "--task-type", options["--task-type"], "--goal", options["--goal"]]
  });
}

export { discussTaskCommand };
