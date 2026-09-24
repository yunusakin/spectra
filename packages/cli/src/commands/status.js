import { findSpectraRoot, getInstalledProfile } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { computeApprovalState } from "../lib/specs.js";
import { buildStatusReport } from "../lib/status-report.js";
import { STAGES, stageOrder } from "../lib/specs/stages.js";

function statusCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd"]
  });

  if (options["--help"]) {
    title("Usage: spectra status [--cwd <path>]");
    return 0;
  }

  const cwd = options["--cwd"] ?? process.cwd();
  const repoRoot = findSpectraRoot(cwd);
  if (!repoRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }
  const profile = getInstalledProfile(repoRoot);
  const report = buildStatusReport(repoRoot);

  title("Spectra Project Status");
  title(`Profile: ${profile}`);
  title("");
  title("Recent updates:");
  if (report.recentUpdates.length === 0) {
    title("- No recent project changes found.");
  } else {
    for (const update of report.recentUpdates) {
      title(`- ${update}`);
    }
  }

  let nextApproval = null;
  if (profile === "full") {
    const approval = computeApprovalState(repoRoot);
    nextApproval = { invalidations: approval.invalidations, nextStage: STAGES[stageOrder(approval.highest_valid_state) + 1] };
    title("");
    title(`Approval State: ${approval.current_state}`);
    title(`Highest Valid: ${approval.highest_valid_state}`);
    if (approval.invalidations.length > 0) {
      title(`Invalidations: ${approval.invalidations.length}`);
    }
  }

  // Only recommendation derivable from state already computed above: approvals
  // invalidated by later changes must be re-granted stage by stage.
  const invalidated = nextApproval && nextApproval.invalidations.length > 0;
  title("");
  title("Next recommended action:");
  title(invalidated ? `  spectra approve --stage ${nextApproval.nextStage}` : "  spectra check");
  return 0;
}

export { statusCommand };
