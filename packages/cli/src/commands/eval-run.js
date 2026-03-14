import { findSpectraRoot } from "@spectra/core";
import { fail, ok, title } from "../lib/output.js";
import { runEvalSuite } from "../lib/specs.js";
import { parseOptions } from "../lib/options.js";

function evalRunCommand(argv) {
  const { options, positional } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--feature", "--suite"]
  });

  if (options["--help"]) {
    title("Usage: spectra eval [feature-id] [--feature <id>] [--suite <smoke|release>] [--cwd <path>]");
    return 0;
  }

  const repoRoot = findSpectraRoot(options["--cwd"] ?? process.cwd());
  if (!repoRoot) {
    throw new Error(`Could not find a Spectra runtime from ${options["--cwd"] ?? process.cwd()}`);
  }

  const featureId = options["--feature"] ?? positional[0] ?? null;
  const report = runEvalSuite(repoRoot, {
    featureId,
    suiteId: options["--suite"] ?? "smoke"
  });

  if (report.passed) {
    ok(`Eval suite passed (${report.totals.passed}/${report.totals.scenarios})`);
    return 0;
  }

  fail(`Eval suite failed (${report.totals.passed}/${report.totals.scenarios})`);
  return 1;
}

export { evalRunCommand };
