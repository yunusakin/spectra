// Phase 1H — real execution evidence for Repo Index test targets.
//
// Audit result that shapes the design: nothing in Spectra executes tests today. `spectra verify`
// runs structural/governance checks (validate-repo, check-policy, review-gate, content checks, spec
// evals); the Repo Index discovers test targets and records their command (`attributes.command`,
// for Node `scripts.test`) but never runs them. The producer therefore executes that recorded
// command, once, for one explicitly requested target, and records the completed result with the
// Phase 1G evidence API. No new runner, no orchestration, no aggregation across targets.
//
// Failure modes enumerated BEFORE implementation:
//  - a result recorded for a command that did not complete (spawn error, signal, timeout, 126/127)
//  - a previous valid record overwritten or deleted by an incomplete execution
//  - a passing record for a target that was never executed (planned, existing, indexed)
//  - a non-zero exit stored as anything but `failed`
//  - signatures read AFTER the run, so an edit made during the run looks fresh
//  - running a command the Repo Index no longer has (stale index) or a target without a command
//  - an aggregate command (npm workspaces) labelled as an exact per-target result
//  - pass->fail / fail->pass not replacing the previous record
//  - freshness depending on time, or an unrelated edit staling evidence
//  - a passing target verifying a rule whose path goes through a different target
//  - modules with no test target hidden when another module of the same rule is verified
//  - a corrupt evidence cache blocking recording or producing a false `verified`
//  - non-deterministic evidence bytes (timestamps, ordering)
//  - existing `spectra verify` behaviour changing when the new flag is absent
//  - projects without Governs/evidence being treated as invalid

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { buildTraceability } from "../src/lib/traceability/trace.js";
import { traceabilityMetrics } from "../src/lib/traceability/metrics.js";
import { concludeVerification, readVerificationEvidence } from "../src/lib/traceability/evidence.js";
import { runTestTarget } from "../src/lib/traceability/run.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const sdd = (root) => path.join(root, ".spectra", "sdd");
const rulesFile = (root) => path.join(sdd(root), "memory-bank", "business", "loyalty", "rules.md");
const LOYALTY_TARGET = "node:test-target:packages/loyalty";
const BILLING_TARGET = "node:test-target:packages/billing";

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const touch = (file) => { const future = new Date(Date.now() + 5000); fs.utimesSync(file, future, future); };

const SPEC = {
  metadata: { id: "alpha" },
  requirements: { functional: [{ id: "FR-1", statement: "Customers redeem loyalty credits" }, { id: "FR-2", statement: "Warehouse ships parcels" }], nonFunctional: [] },
  acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "a customer", when: "they redeem", then: "credits drop" }] }
};

// loyalty and billing both have a test script; `exit.txt` decides the exit status of loyalty's.
function project({ billingTests = true, governsBoth = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-evidence-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node check.js" } }));
  write(path.join(root, "packages", "loyalty", "check.js"), "process.exit(Number(require('fs').readFileSync(__dirname + '/exit.txt', 'utf8')));\n");
  write(path.join(root, "packages", "loyalty", "exit.txt"), "0");
  write(path.join(root, "packages", "billing", "package.json"), JSON.stringify({ name: "billing", ...(billingTests ? { scripts: { test: "node -e \"process.exit(0)\"" } } : {}) }));
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "", "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| loyalty-api | Loyalty | packages/loyalty/ | loyalty |", "| billing | Billing | packages/billing/ | loyalty |", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "INDEX.md"), [
    "# Business Domain Index", "", "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| loyalty | points | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |", ""
  ].join("\n"));
  write(rulesFile(root), [
    "# Rules", "",
    "## RULE-LOY-001 — Expiration", "", "Expired points cannot pay for orders.", "", "Status: active", `Affected Modules: ${governsBoth ? "loyalty-api, billing" : "loyalty-api"}`, "Governs: alpha#FR-1", "",
    "## RULE-LOY-002 — Rounding", "", "Totals round half up.", "", "Status: active", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "unresolved.md"), "# U\n");
  write(path.join(sdd(root), "features", "alpha", "feature.spec.yaml"), YAML.stringify(SPEC));
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

const setExit = (root, code) => write(path.join(root, "packages", "loyalty", "exit.txt"), String(code));
const conclude = (root, id = "RULE-LOY-001") => concludeVerification(buildTraceability(root), readVerificationEvidence(root), id);
const evidenceBytes = (root) => fs.readFileSync(readVerificationEvidence(root).file, "utf8");

test("a completed passing run records passed evidence and the rule becomes verified", () => {
  const root = project();
  const outcome = runTestTarget(root, LOYALTY_TARGET);
  assert.deepEqual([outcome.recorded, outcome.result, outcome.exitStatus], [true, "passed", 0]);
  const [record] = readVerificationEvidence(root).records;
  assert.deepEqual([record.testTarget, record.result, record.command, record.granularity], [LOYALTY_TARGET, "passed", "node check.js", "test-target"]);
  const conclusion = conclude(root);
  assert.equal(conclusion.verification, "verified");
  assert.equal(conclude(root, "alpha#FR-1").verification, "verified");
});

test("a completed failing run is `failed` evidence, not `unverified`", () => {
  const root = project();
  setExit(root, 3);
  const outcome = runTestTarget(root, LOYALTY_TARGET);
  assert.deepEqual([outcome.recorded, outcome.result, outcome.exitStatus], [true, "failed", 3]);
  assert.equal(conclude(root).verification, "failed");
});

test("pass replaces fail and fail replaces pass for the same target", () => {
  const root = project();
  setExit(root, 1);
  runTestTarget(root, LOYALTY_TARGET);
  assert.equal(conclude(root).verification, "failed");
  setExit(root, 0);
  runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).records.length, 1);
  assert.equal(conclude(root).verification, "verified");
  setExit(root, 2);
  runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).records.length, 1);
  assert.equal(conclude(root).verification, "failed");
});

test("an execution that does not complete records nothing and keeps the previous valid record", () => {
  const root = project();
  runTestTarget(root, LOYALTY_TARGET);
  const before = evidenceBytes(root);
  const broken = (command) => write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: command } }));

  broken("definitely-not-a-command-xyz");
  assert.equal(run(root, ["index"]).status, 0);
  const missing = runTestTarget(root, LOYALTY_TARGET);
  assert.equal(missing.recorded, false);
  assert.match(missing.reason, /not found|unavailable|did not complete/i);
  assert.equal(evidenceBytes(root), before);

  broken("node -e \"setTimeout(() => {}, 60000)\"");
  assert.equal(run(root, ["index"]).status, 0);
  const timedOut = runTestTarget(root, LOYALTY_TARGET, { timeoutMs: 300 });
  assert.equal(timedOut.recorded, false);
  assert.match(timedOut.reason, /timed out|did not complete/i);
  assert.equal(evidenceBytes(root), before);
});

test("a never-executed target has no evidence: indexing, listing and tracing record nothing", () => {
  const root = project();
  buildTraceability(root);
  assert.equal(readVerificationEvidence(root).status, "missing");
  assert.equal(conclude(root).verification, "unverified");
});

test("unknown targets, targets without a command and a stale Repo Index are refused before running", () => {
  const root = project();
  assert.throws(() => runTestTarget(root, "node:test-target:nope"), /unknown test target/i);
  fs.cpSync(path.join(cliRoot, "test", "fixtures", "dotnet-solution"), path.join(root, "services"), { recursive: true });
  assert.equal(run(root, ["index"]).status, 0);
  const dotnet = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "cache", "index", "repo-index.json"), "utf8")).records.find((record) => record.kind === "test-target" && record.id.startsWith("dotnet:"));
  assert.throws(() => runTestTarget(root, dotnet.id), /no recorded command/i);
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node check.js --changed" } }));
  assert.throws(() => runTestTarget(root, LOYALTY_TARGET), /spectra index/);
  assert.equal(readVerificationEvidence(root).status, "missing");
});

test("signatures are taken before the run: an edit made while the tests run leaves the evidence stale", () => {
  const root = project();
  const edit = `require('fs').appendFileSync(${JSON.stringify(rulesFile(root))}, '\\nStatement changed mid-run.\\n')`;
  write(path.join(root, "packages", "loyalty", "check.js"), `${edit};\nprocess.exit(0);\n`);
  assert.equal(run(root, ["index"]).status, 0);
  const outcome = runTestTarget(root, LOYALTY_TARGET);
  assert.equal(outcome.result, "passed");
  assert.equal(conclude(root).verification, "stale");
});

test("an edit to the governed rule, requirement or test target stales real evidence; an unrelated edit does not", () => {
  const edits = {
    rule: (root) => { fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Expired points cannot pay", "Expired points can pay")); touch(rulesFile(root)); },
    requirement: (root) => { const file = path.join(sdd(root), "features", "alpha", "feature.spec.yaml"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("redeem loyalty credits", "redeem loyalty credits at the till")); touch(file); },
    testTarget: (root) => { write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node check.js --all" } })); assert.equal(run(root, ["index"]).status, 0); },
    unrelated: (root) => { fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Totals round half up.", "Totals round half down.")); touch(rulesFile(root)); }
  };
  for (const [name, edit] of Object.entries(edits)) {
    const root = project();
    runTestTarget(root, LOYALTY_TARGET);
    edit(root);
    assert.equal(conclude(root).verification, name === "unrelated" ? "verified" : "stale", name);
  }
});

test("a passing target does not verify a rule whose path goes through another target", () => {
  const root = project();
  fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Affected Modules: loyalty-api", "Affected Modules: billing"));
  touch(rulesFile(root));
  runTestTarget(root, LOYALTY_TARGET);
  assert.equal(conclude(root).verification, "unverified");
  runTestTarget(root, BILLING_TARGET);
  assert.equal(conclude(root).verification, "verified");
});

test("multiple paths: one fresh pass suffices, any fresh failure dominates, and modules without a test target stay visible", () => {
  const root = project({ governsBoth: true, billingTests: false });
  runTestTarget(root, LOYALTY_TARGET);
  const verified = conclude(root);
  assert.equal(verified.verification, "verified");
  assert.deepEqual(verified.modulesWithoutTestTarget, ["node:module:packages/billing"], "the untested module is reported, not hidden");

  const both = project({ governsBoth: true });
  runTestTarget(both, LOYALTY_TARGET);
  setExit(both, 1);
  runTestTarget(both, BILLING_TARGET);
  assert.equal(conclude(both).verification, "verified", "billing passed, loyalty passed earlier");
  runTestTarget(both, LOYALTY_TARGET);
  assert.equal(conclude(both).verification, "failed", "a fresh failure on any path dominates");
});

test("a root target that fans out to workspaces is recorded as aggregate evidence, not exact", () => {
  const root = project();
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"], scripts: { test: "npm test --workspaces --if-present" } }));
  assert.equal(run(root, ["index"]).status, 0);
  const outcome = runTestTarget(root, "node:test-target:.");
  assert.equal(outcome.result, "passed");
  assert.equal(readVerificationEvidence(root).records.find((record) => record.testTarget === "node:test-target:.").granularity, "aggregate");
  runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).records.find((record) => record.testTarget === LOYALTY_TARGET).granularity, "test-target");
});

test("evidence bytes are deterministic and never depend on time", () => {
  const root = project();
  runTestTarget(root, LOYALTY_TARGET);
  const first = evidenceBytes(root);
  runTestTarget(root, LOYALTY_TARGET);
  assert.equal(evidenceBytes(root), first);
  assert.equal(/\d{4}-\d{2}-\d{2}T|\d{13}/.test(first), false);
});

test("a corrupt evidence cache is replaced by a clean record and never reads as verified", () => {
  const root = project();
  runTestTarget(root, LOYALTY_TARGET);
  fs.writeFileSync(readVerificationEvidence(root).file, "{ broken");
  assert.equal(conclude(root).verification, "unverified");
  runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).status, "ok");
  assert.equal(conclude(root).verification, "verified");
});

test("metrics separate traceability from executable verification coverage", () => {
  const root = project();
  runTestTarget(root, LOYALTY_TARGET);
  const metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.deepEqual(metrics.evidence, { freshPassed: 1, freshFailed: 0, stale: 0 });
  assert.equal(metrics.rulesWithCompletePath, 1);
  assert.deepEqual(metrics.verification, { verified: 1, failed: 0, stale: 0, unverified: 1 });
  setExit(root, 1);
  runTestTarget(root, LOYALTY_TARGET);
  assert.deepEqual(traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root)).evidence, { freshPassed: 0, freshFailed: 1, stale: 0 });
});

test("`spectra verify --test-target` runs, records and reports; its exit code follows the result", () => {
  const root = project();
  const passed = run(root, ["verify", "--test-target", LOYALTY_TARGET]);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  assert.match(passed.stdout, /RULE-LOY-001.*verified/);
  assert.equal(readVerificationEvidence(root).records[0].result, "passed");
  setExit(root, 1);
  const failed = run(root, ["verify", "--test-target", LOYALTY_TARGET]);
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /RULE-LOY-001.*failed/);
  assert.equal(readVerificationEvidence(root).records[0].result, "failed");
  const unknown = run(root, ["verify", "--test-target", "node:test-target:nope"]);
  assert.equal(unknown.status, 1);
  assert.match(`${unknown.stdout}${unknown.stderr}`, /unknown test target/i);
});

test("without the flag `spectra verify` does not execute tests or touch evidence", () => {
  const root = project();
  run(root, ["verify"]);
  assert.equal(readVerificationEvidence(root).status, "missing");
});

test("a project with no Governs and no evidence stays valid and unverified", () => {
  const root = project();
  fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Governs: alpha#FR-1\n", ""));
  touch(rulesFile(root));
  assert.equal(runTestTarget(root, LOYALTY_TARGET).recorded, true);
  assert.equal(conclude(root).verification, "unverified");
});
