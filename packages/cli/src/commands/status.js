import { findSpectraRoot } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { computeApprovalState } from "../lib/specs.js";
import { buildStatusReport } from "../lib/status-report.js";
import { STAGES, stageOrder } from "../lib/specs/stages.js";
import { inspectProjectCompatibility } from "../lib/project-compatibility.js";
import { ContractError, guardJson, parseArguments, versioned } from "../lib/contract.js";

// One status state, two renderings (human lines and --json). Compatibility that is not current stops the report.
function collectStatus(repoRoot, { persist }) {
  const compatibility = inspectProjectCompatibility(repoRoot);
  const sourceRuntime = compatibility.sourceRepository && compatibility.layout === "root-sdd" && compatibility.conflicts.length === 0;
  if (compatibility.status !== "CURRENT" && !sourceRuntime) return { compatible: false, compatibility };
  const approval = computeApprovalState(repoRoot, { persist });
  const invalidated = approval.invalidations.length > 0;
  return {
    compatible: true,
    compatibility: { status: compatibility.status },
    recentUpdates: buildStatusReport(repoRoot).recentUpdates,
    approval: { currentState: approval.current_state, highestValid: approval.highest_valid_state, invalidations: approval.invalidations },
    nextAction: invalidated ? `spectra approve --stage ${STAGES[stageOrder(approval.highest_valid_state) + 1]}` : "spectra check"
  };
}

function printIncompatible({ compatibility }) {
  title(`Compatibility: ${compatibility.status}`);
  title(`Application: ${compatibility.applicationVersion}; project schema: ${compatibility.projectSchemaVersion ?? "unknown"}; readable schema: ${compatibility.minimumReadableSchema}-${compatibility.maximumReadableSchema}`);
  title(compatibility.reason);
}

function printStatus({ recentUpdates, approval, nextAction }) {
  title("Spectra Project Status");
  title("");
  title("Recent updates:");
  if (recentUpdates.length === 0) {
    title("- No recent project changes found.");
  } else {
    for (const update of recentUpdates) {
      title(`- ${update}`);
    }
  }
  title("");
  title(`Approval State: ${approval.currentState}`);
  title(`Highest Valid: ${approval.highestValid}`);
  if (approval.invalidations.length > 0) {
    title(`Invalidations: ${approval.invalidations.length}`);
  }
  title("");
  title("Next recommended action:");
  title(`  ${nextAction}`);
}

function statusCommand(argv) {
  return guardJson(argv, () => runStatus(argv));
}

function runStatus(argv) {
  const { options } = parseArguments(() => parseOptions(argv, {
    booleanFlags: ["--help", "--json"],
    stringFlags: ["--cwd"]
  }));

  if (options["--help"]) {
    title("Usage: spectra status [--cwd <path>] [--json]");
    return 0;
  }

  const cwd = options["--cwd"] ?? process.cwd();
  const repoRoot = findSpectraRoot(cwd);
  if (!repoRoot) {
    throw new ContractError("project-not-found", `Could not find a Spectra runtime from ${cwd}`);
  }
  const status = collectStatus(repoRoot, { persist: !options["--json"] });
  if (options["--json"]) {
    const { compatible, ...document } = status;
    title(JSON.stringify(versioned(document), null, 2));
  } else if (status.compatible) {
    printStatus(status);
  } else {
    printIncompatible(status);
  }
  return status.compatible ? 0 : 1;
}

export { statusCommand };
