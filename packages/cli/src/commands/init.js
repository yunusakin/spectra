import { installSpectra } from "../lib/install.js";
import { next, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { resolveGitMode } from "../lib/git-policy.js";
import { normalizeProfile } from "../lib/profile.js";

async function initCommand(argv) {
  const { options, positional } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--agents", "--git-mode", "--profile"]
  });

  if (options["--help"]) {
    title("Usage: spectra init [path] [--profile <lite|full>] [--agents <csv>] [--git-mode <local|shared>]");
    return 0;
  }

  const targetDir = positional[0] ?? ".";
  const profile = normalizeProfile(options["--profile"]);
  const gitMode = await resolveGitMode({ requestedMode: options["--git-mode"], isTTY: false });
  const result = installSpectra({
    targetDir,
    agents: options["--agents"] ?? "",
    profile,
    gitMode
  });

  ok(`Installed Spectra runtime in ${result.targetDir}`);
  next(`cd ${result.targetDir}`);
  next("./spectra/bin/spectra check");
  return 0;
}

export { initCommand };
