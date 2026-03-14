import { installSpectra } from "../lib/install.js";
import { next, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function initCommand(argv) {
  const { options, positional } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--agents"]
  });

  if (options["--help"]) {
    title("Usage: spectra init [path] [--agents <csv>]");
    return 0;
  }

  const targetDir = positional[0] ?? ".";
  const result = installSpectra({
    targetDir,
    agents: options["--agents"] ?? ""
  });

  ok(`Installed Spectra runtime in ${result.targetDir}`);
  next(`cd ${result.targetDir}`);
  next("spectra validate");
  return 0;
}

export { initCommand };
