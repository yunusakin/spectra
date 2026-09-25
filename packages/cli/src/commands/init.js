import { installSpectra } from "../lib/install.js";
import { next, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { resolveGitMode } from "../lib/git-policy.js";

async function initCommand(argv) {
  const { options, positional } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--agents", "--git-mode"]
  });

  if (options["--help"]) {
    title("Usage: spectra init [path] [--agents <csv>] [--git-mode <local|shared>]");
    return 0;
  }

  const targetDir = positional[0] ?? ".";
  const gitMode = await resolveGitMode({ requestedMode: options["--git-mode"], isTTY: false });
  const result = installSpectra({
    targetDir,
    agents: options["--agents"] ?? "",
    gitMode
  });

  ok(`Installed Spectra runtime in ${result.targetDir}`);
  next(`cd ${result.targetDir}`);
  next("./.spectra/bin/spectra check");
  return 0;
}

export { initCommand };
