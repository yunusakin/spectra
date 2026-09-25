import { findSpectraRoot } from "../lib/runtime.js";
import { approveStage, computeApprovalState } from "../lib/specs.js";
import { fail, next, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { runVerifyWork } from "../lib/verify-runner.js";

function approveCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--stage"]
  });

  if (options["--help"]) {
    title("Usage: spectra approve --stage <product-approved|technical-approved|implementation-approved|release-approved> [--cwd <path>]");
    return 0;
  }

  if (!options["--stage"]) {
    throw new Error("Missing required flag: --stage");
  }

  const repoRoot = findSpectraRoot(options["--cwd"] ?? process.cwd());
  if (!repoRoot) {
    throw new Error(`Could not find a Spectra runtime from ${options["--cwd"] ?? process.cwd()}`);
  }

  const previous = computeApprovalState(repoRoot).highest_valid_state;
  const shellStatus =
    options["--stage"] === "release-approved" ? runVerifyWork({ cwd: options["--cwd"] ?? process.cwd() }) : undefined;
  const updated = approveStage(repoRoot, options["--stage"], { shellStatus });

  ok(`Approval stage updated: ${previous} -> ${updated.current_state}`);
  next("./.spectra/bin/spectra check");
  if (updated.current_state === "release-approved") {
    next("./.spectra/bin/spectra verify");
  }
  return 0;
}

export { approveCommand };
