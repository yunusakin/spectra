import { createInterface } from "node:readline/promises";
import { executeApplicationUninstall, inspectApplicationInstallation, planApplicationUninstall } from "../lib/application-installation.js";
import { fail, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

async function uninstallCommand(argv) {
  const { options } = parseOptions(argv, { booleanFlags: ["--help", "--yes"] });
  if (options["--help"]) {
    title("Usage: spectra uninstall [--yes]");
    title("Remove verified machine-installed Spectra versions. Project files are never changed.");
    return 0;
  }
  const installation = inspectApplicationInstallation();
  if (installation.kind !== "native-managed") {
    const guidance = installation.kind === "npm" ? "Remove this package with: npm uninstall -g spectra-pack"
      : installation.kind === "npx" ? "npx uses a temporary package cache; no managed native installation was found."
      : installation.kind === "local-fallback" ? "This project-local fallback is managed by its project; no machine installation was found."
      : installation.kind === "development" ? "This development checkout is not a machine installation."
      : "No verified managed native installation was found. Install with the supported Spectra installer to manage it here.";
    title(guidance);
    return 0;
  }
  if (installation.legacy) {
    fail("This verified legacy installation has no machine ownership record and was left untouched. Update it to a newer managed version with `spectra update --yes`, then run `spectra uninstall --yes`.");
    return 1;
  }
  const plan = planApplicationUninstall(installation);
  title(`Remove ${plan.versions.length} verified Spectra version(s) and ${plan.commandPath}?`);
  if (!options["--yes"]) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      fail("Uninstall requires confirmation. Run spectra uninstall --yes in a non-interactive terminal.");
      return 1;
    }
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try { answer = (await prompt.question("Continue? [y/N] ")).trim().toLowerCase(); }
    finally { prompt.close(); }
    if (answer !== "y" && answer !== "yes") { title("Uninstall cancelled."); return 0; }
  }
  const result = executeApplicationUninstall(plan);
  for (const item of result.removed) ok(`Removed ${item}`);
  for (const item of result.preserved) title(`Preserved ${item}`);
  for (const item of result.manualRecovery || []) fail(`Uninstall paused. Inspect or remove the partial owned runtime at ${item}, then retry 'spectra uninstall --yes'.`);
  return result.preserved.length ? 1 : 0;
}

export { uninstallCommand };
