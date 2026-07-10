import { findSpectraRoot, getInstalledProfile } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { computeApprovalState } from "../lib/specs.js";
import { buildStatusReport } from "../lib/status-report.js";

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

  if (profile === "full") {
    const approval = computeApprovalState(repoRoot);
    title("");
    title(`Approval State: ${approval.current_state}`);
    title(`Highest Valid: ${approval.highest_valid_state}`);
    if (approval.invalidations.length > 0) {
      title(`Invalidations: ${approval.invalidations.length}`);
    }
  }

  title("");
  title("Next recommended action:");
  title("  spectra check");
  return 0;
}

export { statusCommand };
