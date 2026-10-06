import { runVerifyWork } from "../lib/verify-runner.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { findSpectraRoot } from "../lib/runtime.js";
import { verifyV2 } from "../lib/specs.js";
import { buildTraceability, traceSubject } from "../lib/traceability/trace.js";
import { concludeVerification, readVerificationEvidence } from "../lib/traceability/evidence.js";
import { runTestTarget } from "../lib/traceability/run.js";
import { STAGES, evaluateGate, rulesForChangedFiles } from "../lib/traceability/gates.js";
import { assertRefsResolve, getChangedFiles, isGitRepo } from "../lib/git-diff.js";
import { countsForImpact } from "../lib/source-boundary.js";
import { ContractError, guardJson, parseArguments, versioned } from "../lib/contract.js";

// Runs one test target, records the evidence and says what it now supports. Exit status follows the result.
async function verifyTestTarget(cwd, testTarget) {
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) {
    fail(`Could not find a Spectra runtime from ${cwd}`);
    return 1;
  }
  let outcome;
  try {
    outcome = await runTestTarget(projectRoot, testTarget);
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

// Read-only: why one subject (rule, requirement, scenario or invariant) has its verification
// conclusion, naming every missing layer. Never runs tests and never writes.
function explainSubject(cwd, id, json) {
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) throw new ContractError("project-not-found", `Could not find a Spectra runtime from ${cwd}`);
  const trace = buildTraceability(projectRoot);
  if (!trace.subjects[id]) throw new ContractError("subject-not-found", `Unknown subject: ${id} (expected a business rule, requirement, scenario or invariant ID)`);
  const conclusion = concludeVerification(trace, readVerificationEvidence(projectRoot), id);
  if (json) {
    process.stdout.write(`${JSON.stringify(versioned(conclusion), null, 2)}\n`);
    return 0;
  }
  title(`${id}: ${conclusion.verification}`);
  title(`  Reason: ${conclusion.reason}`);
  for (const line of conclusion.explanation) title(`  - ${line}`);
  return 0;
}

// Read-only stage readiness: the verification gate for implementation, review or release. Review can be
// narrowed to the rules the changed files concern; release is project-wide. Exit 1 only when blocked.
function gateStage(cwd, stage, { changed, base, head, json }) {
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) throw new ContractError("project-not-found", `Could not find a Spectra runtime from ${cwd}`);
  let result;
  const trace = buildTraceability(projectRoot);
  const narrowed = changed || base;
  const determinable = !narrowed || isGitRepo(projectRoot);
  if (determinable) assertRefsResolve(projectRoot, [base, head]);
  // Scope that cannot be determined (not a git repository) never narrows the gate: it falls back to the whole project.
  result = evaluateGate(trace, readVerificationEvidence(projectRoot), stage, { rules: narrowed && determinable ? rulesForChangedFiles(trace, getChangedFiles(projectRoot, { base, head }).filter(countsForImpact)) : null });
  if (narrowed && !determinable) result.warnings.unshift({ code: "scope-undeterminable", rule: null, reason: "this is not a git repository, so changed files cannot be determined; the gate covers the whole project" });
  if (json) {
    process.stdout.write(`${JSON.stringify(versioned(result), null, 2)}\n`);
    return result.status === "blocked" ? 1 : 0;
  }
  const label = `${stage[0].toUpperCase()}${stage.slice(1)} gate`;
  title(`${label}: ${result.status}${result.status === "blocked" ? " (verification incomplete)" : ""} [scope: ${result.scope.kind === "changed" ? `${result.scope.rules.length} rule(s) concerned by the changed files` : "project"}]`);
  // Human view groups by code and scope (one aggregate target usually serves many subjects): the rerun
  // action is stated once. --json keeps every blocker and warning.
  const grouped = (items) => [...items.reduce((groups, item) => groups.set(`${item.code}\t${item.scope ?? item.module ?? ""}`, [...(groups.get(`${item.code}\t${item.scope ?? item.module ?? ""}`) ?? []), item]), new Map()).values()];
  for (const group of grouped(result.blockers)) {
    const [first] = group;
    title(`  BLOCKER ${first.code}${first.scope ? ` via ${first.scope}` : ""} (${first.evidence}): ${group.length} subject/rule pair(s)`);
    title(`    ${first.reason}`);
    title(`    affects: ${[...new Set(group.map((item) => item.rule).filter(Boolean))].join(", ") || "no rule (canonical structure)"}`);
    title(`    subjects: ${[...new Set(group.map((item) => item.subject).filter(Boolean))].join(", ")}`);
    title(`    action: ${first.action}`);
  }
  for (const group of grouped(result.warnings)) {
    const [first] = group;
    title(`  warning ${first.code}${first.scope ? ` via ${first.scope}` : ""}${first.module ? ` ${first.module}` : ""}: ${[...new Set(group.map((item) => item.rule))].join(", ")}${group.some((item) => item.subject) ? ` (${[...new Set(group.map((item) => item.subject).filter(Boolean))].join(", ")})` : ""} - ${first.reason}`);
  }
  return result.status === "blocked" ? 1 : 0;
}

function verifyCommand(argv) {
  return guardJson(argv, () => runVerify(argv));
}

async function runVerify(argv) {
  const { options } = parseArguments(() => parseOptions(argv, {
    booleanFlags: ["--help", "--json", "--changed"],
    stringFlags: ["--cwd", "--scope", "--item", "--test-target", "--explain", "--gate", "--base", "--head"]
  }));

  if (options["--help"]) {
    title("Usage: spectra verify [--cwd <path>] [--scope <all|spec|app>] [--item <id>] [--test-target <id>] [--explain <id> [--json]] [--gate <implementation|review|release> [--changed|--base <ref> [--head <ref>]] [--json]]");
    title("  --gate reports, read-only, whether the verification evidence lets that stage proceed (exit 1 when blocked). Implementation is never blocked; review and release are blocked by failed, stale or unexecuted declared scopes. Review can be narrowed to the changed files; release is project-wide.");
    title("  --explain shows, read-only, why a rule, requirement, scenario or invariant is verified, failed, stale or unverified, naming each missing layer.");
    title("  --test-target runs that Repo Index test target's own command once, records the completed result as local verification evidence and reports the subjects it supports; it skips the other stages.");
    return 0;
  }

  if (options["--gate"]) {
    const gate = options["--gate"];
    if (!STAGES.includes(gate)) {
      throw new ContractError("invalid-arguments", `Unknown gate stage: ${gate} (expected ${STAGES.join(", ")})`);
    }
    if (options["--scope"] || options["--item"] || options["--test-target"] || options["--explain"]) {
      throw new ContractError("invalid-arguments", "--gate is read-only and cannot be combined with --scope, --item, --test-target or --explain.");
    }
    if (options["--head"] && !options["--base"]) {
      throw new ContractError("invalid-arguments", "--head needs --base: it names the end of the compared range.");
    }
    if (gate === "release" && (options["--changed"] || options["--base"])) {
      throw new ContractError("invalid-arguments", "The release gate is project-wide by design; --changed and --base apply to the review gate.");
    }
    return gateStage(options["--cwd"] ?? process.cwd(), gate, { changed: options["--changed"], base: options["--base"], head: options["--head"], json: options["--json"] });
  }

  if (options["--explain"]) {
    if (options["--scope"] || options["--item"] || options["--test-target"]) {
      throw new ContractError("invalid-arguments", "--explain is read-only and cannot be combined with --scope, --item or --test-target.");
    }
    return explainSubject(options["--cwd"] ?? process.cwd(), options["--explain"], options["--json"]);
  }

  if (options["--test-target"]) {
    if (options["--scope"] || options["--item"]) {
      fail("--test-target cannot be combined with --scope or --item: it runs one test target and skips the other verify stages.");
      return 1;
    }
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
