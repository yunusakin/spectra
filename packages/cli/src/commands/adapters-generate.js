import { runInstalledScript } from "@spectra/core";
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

  return runInstalledScript({
    cwd: options["--cwd"] ?? process.cwd(),
    scriptName: "generate-adapters.sh",
    args: [
      "--agents",
      options["--agents"],
      "--target",
      options["--target"] ?? options["--cwd"] ?? process.cwd()
    ]
  });
}

export { adaptersGenerateCommand };
