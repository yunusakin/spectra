import { runVerifyWork } from "../lib/verify-runner.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { findSpectraRoot } from "../lib/runtime.js";
import { verifyV2 } from "../lib/specs.js";
import { buildTraceability, traceSubject } from "../lib/traceability/trace.js";
import { concludeVerification, readVerificationEvidence } from "../lib/traceability/evidence.js";
import { runTestTarget } from "../lib/traceability/run.js";

// Runs one test target, records the evidence and says what it now supports. Exit status follows the result.
function verifyTestTarget(cwd, testTarget) {
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) {
    fail(`Could not find a Spectra runtime from ${cwd}`);
    return 1;
  }
  let outcome;
  try {
    outcome = runTestTarget(projectRoot, testTarget);
  } catch (error) {
    fail(error.message);
    return 1;
  }
  title("");
  title(`Spectra Verify: test target ${testTarget}`);
  title(`Command: ${outcome.command}`);
  if (!outcome.recorded) {
    fail(`No evidence recorded: ${outcome.reason}`);
    return 1;
  }
  title(`Result: ${outcome.result} (exit ${outcome.exitStatus}, ${outcome.granularity} evidence recorded)`);
  const trace = buildTraceability(projectRoot);
  const evidence = readVerificationEvidence(projectRoot);
  for (const id of Object.keys(trace.subjects).filter((candidate) => traceSubject(trace, candidate).paths.some((entry) => entry.testTarget === testTarget))) {
    const conclusion = concludeVerification(trace, evidence, id);
    title(`  ${id}: ${conclusion.verification} (${conclusion.reason})`);
  }
  if (outcome.result === "failed") {
    warn(outcome.output.trim() || "the command produced no output");
    fail("Test target failed");
    return 1;
  }
  ok("Test target passed");
  return 0;
}

function verifyCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--scope", "--item", "--test-target"]
  });

  if (options["--help"]) {
    title("Usage: spectra verify [--cwd <path>] [--scope <all|spec|app>] [--item <id>] [--test-target <id>]");
    title("  --test-target runs that Repo Index test target's own command once, records the completed result as local verification evidence and reports the subjects it supports; it skips the other stages.");
    return 0;
  }

  if (options["--test-target"]) {
    return verifyTestTarget(options["--cwd"] ?? process.cwd(), options["--test-target"]);
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
