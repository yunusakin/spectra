import { runInstalledScript } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { findSpectraRoot } from "../lib/runtime.js";
import { computeApprovalState } from "../lib/specs.js";

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
  if (repoRoot) {
    computeApprovalState(repoRoot);
  }

  const status = runInstalledScript({
    cwd,
    scriptName: "health-check.sh",
    args: []
  });

  if (repoRoot) {
    const approval = computeApprovalState(repoRoot);
    title(`Approval State: ${approval.current_state}`);
    title(`Highest Valid: ${approval.highest_valid_state}`);
    if (approval.invalidations.length > 0) {
      title(`Invalidations: ${approval.invalidations.length}`);
    }
  }

  return status;
}

export { statusCommand };
