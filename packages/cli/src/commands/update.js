import { createInterface } from "node:readline/promises";
import { getCliVersion } from "../lib/version.js";
import { ok, fail, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { compareVersions, latestVersion, runSelfUpdate } from "../lib/update.js";

async function confirmUpdate(message) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question(`${message}\nContinue? [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    prompt.close();
  }
}

async function updateCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--yes"],
    stringFlags: ["--cwd"]
  });
  if (options["--help"]) {
    title("Usage: spectra update [--cwd <path>] [--yes]");
    title("Update the machine application. Projects migrate separately with spectra migrate.");
    return 0;
  }
  const current = getCliVersion();
  const latest = latestVersion();
  if (compareVersions(current, latest) >= 0) {
    ok("Spectra is already up to date.");
    return 0;
  }
  const details = `A newer Spectra version is available: ${latest}. This will update the machine application.`;
  if (!options["--yes"]) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      fail("Software update requires confirmation. Run spectra update --yes in a non-interactive terminal.");
      return 1;
    }
    if (!(await confirmUpdate(details))) {
      title("Update cancelled.");
      return 0;
    }
  } else {
    title(details);
  }
  return runSelfUpdate(latest);
}

function internalUpdateProjectCommand(argv) {
  parseOptions(argv, { booleanFlags: [], stringFlags: ["--cwd"] });
  fail("__update-project is retired. Run spectra migrate for an old schema/layout, or spectra doctor --fix to repair a current project.");
  return 1;
}

export { internalUpdateProjectCommand, updateCommand };
