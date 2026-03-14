import { installSpectra } from "../lib/install.js";
import { next, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function adoptCommand(argv) {
  const { options, positional } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--agents"]
  });

  if (options["--help"]) {
    title("Usage: spectra adopt [path] [--agents <csv>]");
    return 0;
  }

  const targetDir = positional[0] ?? ".";
  const result = installSpectra({
    targetDir,
    adopt: true,
    agents: options["--agents"] ?? ""
  });

  ok(`Adopted Spectra in ${result.targetDir}`);
  next("spectra status");
  next("spectra validate");
  return 0;
}

export { adoptCommand };
