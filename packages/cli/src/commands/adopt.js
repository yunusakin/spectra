import { createInterface } from "node:readline/promises";
import { installSpectra } from "../lib/install.js";
import { next, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { resolveGitMode } from "../lib/git-policy.js";
import { normalizeProfile } from "../lib/profile.js";

async function askGitMode({ defaultMode }) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = (await prompt.question(`Keep Spectra files local or shared? [${defaultMode}/shared] `))
        .trim()
        .toLowerCase();
      if (answer === "" || answer === "local" || answer === "l") {
        return "local";
      }
      if (answer === "shared" || answer === "s") {
        return "shared";
      }
      title("Enter local or shared.");
    }
  } finally {
    prompt.close();
  }
}

async function adoptCommand(argv) {
  const { options, positional } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--agents", "--git-mode", "--profile"]
  });

  if (options["--help"]) {
    title("Usage: spectra adopt [path] [--profile <lite|full>] [--agents <csv>] [--git-mode <local|shared>]");
    return 0;
  }

  const gitMode = await resolveGitMode({
    requestedMode: options["--git-mode"],
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    ask: askGitMode
  });
  const profile = normalizeProfile(options["--profile"]);
  const targetDir = positional[0] ?? ".";
  const result = installSpectra({
    targetDir,
    adopt: true,
    agents: options["--agents"] ?? "",
    profile,
    gitMode
  });

  ok(`Adopted Spectra in ${result.targetDir}`);
  title(`Git mode: ${result.gitMode}`);
  next("spectra status");
  next("spectra check");
  return 0;
}

export { adoptCommand };
