import { createInterface } from "node:readline/promises";
import { findProjectRoot } from "../lib/project-layout.js";
import { parseOptions } from "../lib/options.js";
import { planProjectMigration, executeProjectMigration } from "../lib/project-migration.js";
import { title, fail } from "../lib/output.js";

async function migrateCommand(argv) {
  let options;
  const jsonRequested = argv.includes("--json") || argv.includes("--json=true");
  const emit = (outcome, details, exit = 1) => {
    if (options?.["--json"] ?? jsonRequested) console.log(JSON.stringify({ outcome, ...details }));
    else { if (details.logs) title(details.logs); (exit === 0 ? title : fail)(details.reason); if (details.recoveryPath) title(`Recovery snapshot: ${details.recoveryPath}`); }
    return exit;
  };
  try {
    const parsed = parseOptions(argv, { booleanFlags: ["--help", "--check", "--json", "--yes"], stringFlags: ["--cwd"] });
    options = parsed.options;
    if (parsed.positional.length) throw new Error("Unexpected positional argument. Use --cwd <path>.");
  } catch (error) { return emit("invalid-usage", { reason: error.message }); }
  if (options["--help"]) { title("Usage: spectra migrate [--cwd <path>] [--check] [--json] [--yes]"); title("Inspect or explicitly migrate one project. Non-interactive execution requires --yes; --check never writes."); return 0; }
  const root = findProjectRoot(options["--cwd"] ?? process.cwd());
  if (!root) return emit("incompatible", { reason: "Could not find a Spectra project." });
  const plan = planProjectMigration(root);
  if (plan.conflicts.length && !plan.resume) {
    const reason = plan.conflicts.some(conflict => /Migration conflict/.test(conflict)) ? `Migration failed during layout migration: ${plan.conflicts.join(" ")}` :
      plan.compatibility.layout === "canonical" && plan.conflicts.some(conflict => /Missing install metadata/.test(conflict)) ? `Incomplete migration detected: ${plan.conflicts.join(" ")}` : plan.conflicts.join(" ");
    return emit("incompatible", { compatibility: plan.compatibility, steps: plan.steps, conflicts: plan.conflicts, reason });
  }
  if (!plan.required && !plan.resume) return emit("current", { ...plan, reason: "Project is already current.", validationStatus: "not-needed" }, 0);
  if (options["--check"]) return emit("migration-required", { ...plan, reason: plan.resume ? "Incomplete migration requires explicit resume with --yes." : `Migration required: ${plan.steps.map(step => step.id).join(" -> ")}` });
  if (!options["--yes"]) {
    if (plan.resume || !process.stdin.isTTY || !process.stdout.isTTY || options["--json"]) return emit("migration-required", { ...plan, reason: "Migration requires confirmation. Run spectra migrate --yes to execute or resume in a non-interactive terminal." });
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    let answer; try { answer = await prompt.question(`Migrate this project to schema 3? [y/N] `); } finally { prompt.close(); }
    if (!["y", "yes"].includes(answer.trim().toLowerCase())) return emit("current", { reason: "Migration cancelled." }, 0);
  }
  const result = executeProjectMigration(root, plan);
  return emit(result.status === "migrated" ? "current" : result.status, result, ["migrated", "current"].includes(result.status) ? 0 : 1);
}

export { migrateCommand };
