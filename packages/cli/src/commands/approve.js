import { findSpectraRoot } from "@spectra/core";
import { approveStage, computeApprovalState } from "../lib/specs.js";
import { fail, next, ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function approveCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--stage"]
  });

  if (options["--help"]) {
    title("Usage: spectra ap --stage <product-approved|technical-approved|implementation-approved|release-approved> [--cwd <path>]");
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
  const updated = approveStage(repoRoot, options["--stage"]);

  ok(`Approval stage updated: ${previous} -> ${updated.current_state}`);
  next("spectra val");
  if (updated.current_state === "release-approved") {
    next("spectra ver --profile release");
  }
  return 0;
}

export { approveCommand };
