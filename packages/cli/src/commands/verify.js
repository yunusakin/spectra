import { runVerifyWork } from "../lib/verify-runner.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { findSpectraRoot } from "../lib/runtime.js";
import { verifyV2 } from "../lib/specs.js";

function verifyCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--scope", "--item"]
  });

  if (options["--help"]) {
    title("Usage: spectra verify [--cwd <path>] [--scope <all|spec|app>] [--item <id>]");
    return 0;
  }

  const status = runVerifyWork({
    cwd: options["--cwd"] ?? process.cwd(),
    scope: options["--scope"],
    item: options["--item"]
  });

  const repoRoot = findSpectraRoot(options["--cwd"] ?? process.cwd());
  if (!repoRoot) {
    fail(`Could not find a Spectra runtime from ${options["--cwd"] ?? process.cwd()}`);
    return 1;
  }

  const report = verifyV2(repoRoot, {
    scope: options["--scope"] ?? "all",
    item: options["--item"] ?? null,
    shellStatus: status
  });

  title("");
  title("Spectra Verify");
  for (const stage of report.stages) {
    title(
      `${stage.blocking ? "FAIL" : stage.warnings.length > 0 ? "WARN" : "OK"} ${stage.name}: ${stage.detail}`
    );
    for (const warning of stage.warnings) {
      warn(`${stage.name}: ${warning}`);
    }
  }
  title(`Release confidence score: ${report.confidenceScore}/100`);

  if (!report.blocked) {
    ok(`Verify passed (${report.verdict})`);
    return 0;
  }

  fail(`Verify blocked (${report.verdict})`);
  return 1;
}

export { verifyCommand };
