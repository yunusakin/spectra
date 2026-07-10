import { createInterface } from "node:readline/promises";
import { findSpectraRoot, readInstallMetadata } from "../lib/runtime.js";
import { installSpectra } from "../lib/install.js";
import { normalizeProfile } from "../lib/profile.js";
import { ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

async function confirmUpgrade(message) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question(`${message}\nContinue? [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    prompt.close();
  }
}

async function upgradeCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--yes"],
    stringFlags: ["--cwd", "--profile", "--agents"]
  });
  if (options["--help"]) {
    title("Usage: spectra upgrade --profile <lite|full> [--agents <csv>] [--cwd <path>] [--yes]");
    return 0;
  }

  const profile = normalizeProfile(options["--profile"]);
  const cwd = options["--cwd"] ?? process.cwd();
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }
  const metadata = readInstallMetadata(projectRoot);
  if (!metadata) {
    throw new Error(`Missing Spectra installation metadata in ${projectRoot}`);
  }
  if (metadata.profile === profile) {
    ok(`Spectra is already using the ${profile} profile.`);
    return 0;
  }
  if (!options["--yes"] && !(await confirmUpgrade(`Change Spectra profile from ${metadata.profile} to ${profile}?`))) {
    title("Upgrade cancelled.");
    return 0;
  }

  installSpectra({
    targetDir: projectRoot,
    adopt: metadata.installMode === "adopt",
    agents: options["--agents"] ?? "",
    gitMode: metadata.gitMode ?? "local",
    profile,
    refresh: false,
    upgrade: true
  });
  ok(`Spectra upgraded to the ${profile} profile.`);
  return 0;
}

export { upgradeCommand };
