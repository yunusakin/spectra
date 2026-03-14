import { runInstalledScript } from "@spectra/core";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function skillsResolveCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--task-type", "--skills"]
  });

  if (options["--help"]) {
    title("Usage: spectra skills --task-type <type> [--skills <csv>] [--cwd <path>]");
    return 0;
  }

  if (!options["--task-type"]) {
    throw new Error("Missing required flag: --task-type");
  }

  const args = ["--task-type", options["--task-type"]];
  if (options["--skills"]) {
    args.push("--skills", options["--skills"]);
  }

  return runInstalledScript({
    cwd: options["--cwd"] ?? process.cwd(),
    scriptName: "resolve-skills.sh",
    args
  });
}

export { skillsResolveCommand };
