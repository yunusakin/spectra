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
import { concludeVerification, readVerificationEvidence, recordVerificationEvidence, withEvidenceLock } from "../src/lib/traceability/evidence.js";
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
  requirements: { functional: [{ id: "FR-1", statement: "Customers redeem loyalty credits", verifiedBy: ["node:test-target:packages/loyalty"] }, { id: "FR-2", statement: "Warehouse ships parcels" }], nonFunctional: [] },
  acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "a customer", when: "they redeem", then: "credits drop" }] }
};

// loyalty and billing both have a test script; `exit.txt` decides the exit status of loyalty's.
function project({ billingTests = true, governsBoth = false, scope = [LOYALTY_TARGET] } = {}) {
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
  write(path.join(sdd(root), "features", "alpha", "feature.spec.yaml"), YAML.stringify({ ...SPEC, requirements: { ...SPEC.requirements, functional: [{ ...SPEC.requirements.functional[0], verifiedBy: scope }, SPEC.requirements.functional[1]] } }));
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

const setExit = (root, code) => write(path.join(root, "packages", "loyalty", "exit.txt"), String(code));
const conclude = (root, id = "RULE-LOY-001") => concludeVerification(buildTraceability(root), readVerificationEvidence(root), id);
const evidenceBytes = (root) => fs.readFileSync(readVerificationEvidence(root).file, "utf8");

test("a completed passing run records passed evidence and the rule becomes verified", async () => {
  const root = project();
  const outcome = await runTestTarget(root, LOYALTY_TARGET);
  assert.deepEqual([outcome.recorded, outcome.result, outcome.exitStatus], [true, "passed", 0]);
  const [record] = readVerificationEvidence(root).records;
  assert.deepEqual([record.testTarget, record.result, record.command, record.granularity], [LOYALTY_TARGET, "passed", "node check.js", "test-target"]);
  const conclusion = conclude(root);
  assert.equal(conclusion.verification, "verified");
  assert.equal(conclude(root, "alpha#FR-1").verification, "verified");
});

test("a completed failing run is `failed` evidence, not `unverified`", async () => {
  const root = project();
  setExit(root, 3);
  const outcome = await runTestTarget(root, LOYALTY_TARGET);
  assert.deepEqual([outcome.recorded, outcome.result, outcome.exitStatus], [true, "failed", 3]);
  assert.equal(conclude(root).verification, "failed");
});

test("pass replaces fail and fail replaces pass for the same target", async () => {
  const root = project();
  setExit(root, 1);
  await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(conclude(root).verification, "failed");
  setExit(root, 0);
  await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).records.length, 1);
  assert.equal(conclude(root).verification, "verified");
  setExit(root, 2);
  await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).records.length, 1);
  assert.equal(conclude(root).verification, "failed");
});

test("an execution that does not complete records nothing and keeps the previous valid record", async () => {
  const root = project();
  await runTestTarget(root, LOYALTY_TARGET);
  const before = evidenceBytes(root);
  const broken = (command) => write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: command } }));

  broken("definitely-not-a-command-xyz");
  assert.equal(run(root, ["index"]).status, 0);
  const missing = await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(missing.recorded, false);
  assert.match(missing.reason, /not found|unavailable|did not complete/i);
  assert.equal(evidenceBytes(root), before);

  broken("node -e \"setTimeout(() => {}, 60000)\"");
  assert.equal(run(root, ["index"]).status, 0);
  const timedOut = await runTestTarget(root, LOYALTY_TARGET, { timeoutMs: 300 });
  assert.equal(timedOut.recorded, false);
  assert.match(timedOut.reason, /timed out|did not complete/i);
  assert.equal(evidenceBytes(root), before);
});

test("a never-executed target has no evidence: indexing, listing and tracing record nothing", async () => {
  const root = project();
  buildTraceability(root);
  assert.equal(readVerificationEvidence(root).status, "missing");
  assert.equal(conclude(root).verification, "unverified");
});

test("unknown targets, targets without a command and a stale Repo Index are refused before running", async () => {
  const root = project();
  await assert.rejects(() => runTestTarget(root, "node:test-target:nope"), /unknown test target/i);
  fs.cpSync(path.join(cliRoot, "test", "fixtures", "dotnet-solution"), path.join(root, "services"), { recursive: true });
  assert.equal(run(root, ["index"]).status, 0);
  const dotnet = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "cache", "index", "repo-index.json"), "utf8")).records.find((record) => record.kind === "test-target" && record.id.startsWith("dotnet:"));
  await assert.rejects(() => runTestTarget(root, dotnet.id), /no recorded command/i);
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node check.js --changed" } }));
  await assert.rejects(() => runTestTarget(root, LOYALTY_TARGET), /spectra index/);
  assert.equal(readVerificationEvidence(root).status, "missing");
});

test("signatures are taken before the run: an edit made while the tests run leaves the evidence stale", async () => {
  const root = project();
  const file = JSON.stringify(rulesFile(root));
  const edit = `const fs = require('fs'); fs.writeFileSync(${file}, fs.readFileSync(${file}, 'utf8').replace('Expired points cannot pay', 'Expired points can pay'))`;
  write(path.join(root, "packages", "loyalty", "check.js"), `${edit};\nprocess.exit(0);\n`);
  assert.equal(run(root, ["index"]).status, 0);
  const outcome = await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(outcome.result, "passed");
  assert.equal(conclude(root).verification, "stale");
});

test("an edit to the governed rule, requirement or test target stales real evidence; an unrelated edit does not", async () => {
  const edits = {
    rule: (root) => { fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Expired points cannot pay", "Expired points can pay")); touch(rulesFile(root)); },
    requirement: (root) => { const file = path.join(sdd(root), "features", "alpha", "feature.spec.yaml"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("redeem loyalty credits", "redeem loyalty credits at the till")); touch(file); },
    testTarget: (root) => { write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node check.js --all" } })); assert.equal(run(root, ["index"]).status, 0); },
    unrelated: (root) => { fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Totals round half up.", "Totals round half down.")); touch(rulesFile(root)); }
  };
  for (const [name, edit] of Object.entries(edits)) {
    const root = project();
    await runTestTarget(root, LOYALTY_TARGET);
    edit(root);
    assert.equal(conclude(root).verification, name === "unrelated" ? "verified" : "stale", name);
  }
});

test("a passing target does not verify a rule whose scope is another target", async () => {
  const root = project({ scope: [BILLING_TARGET] });
  fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Affected Modules: loyalty-api", "Affected Modules: billing"));
  touch(rulesFile(root));
  await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(conclude(root).verification, "unverified");
  await runTestTarget(root, BILLING_TARGET);
  assert.equal(conclude(root).verification, "verified");
});

test("multiple modules: every required path must pass, a fresh failure dominates, and untested modules stay visible", async () => {
  const root = project({ governsBoth: true, billingTests: false, scope: [LOYALTY_TARGET] });
  await runTestTarget(root, LOYALTY_TARGET);
  const incomplete = conclude(root);
  assert.equal(incomplete.verification, "unverified", "one passing path is not enough while another required module has no test");
  assert.deepEqual(incomplete.modulesWithoutTestTarget, ["node:module:packages/billing"], "the untested module is reported, not hidden");

  const both = project({ governsBoth: true, scope: [LOYALTY_TARGET, BILLING_TARGET] });
  await runTestTarget(both, LOYALTY_TARGET);
  assert.equal(conclude(both).verification, "unverified", "billing has no evidence yet");
  await runTestTarget(both, BILLING_TARGET);
  assert.equal(conclude(both).verification, "verified");
  setExit(both, 1);
  await runTestTarget(both, LOYALTY_TARGET);
  assert.equal(conclude(both).verification, "failed", "a fresh failure on any required path dominates");
});

test("a root target that fans out to workspaces is recorded as aggregate evidence, not exact", async () => {
  const root = project();
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"], scripts: { test: "npm test --workspaces --if-present" } }));
  assert.equal(run(root, ["index"]).status, 0);
  const outcome = await runTestTarget(root, "node:test-target:.");
  assert.equal(outcome.result, "passed");
  assert.equal(readVerificationEvidence(root).records.find((record) => record.testTarget === "node:test-target:.").granularity, "aggregate");
  await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).records.find((record) => record.testTarget === LOYALTY_TARGET).granularity, "test-target");
});

test("evidence bytes are deterministic and never depend on time", async () => {
  const root = project();
  await runTestTarget(root, LOYALTY_TARGET);
  const first = evidenceBytes(root);
  await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(evidenceBytes(root), first);
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(first), false);
});

test("a corrupt evidence cache is replaced by a clean record and never reads as verified", async () => {
  const root = project();
  await runTestTarget(root, LOYALTY_TARGET);
  fs.writeFileSync(readVerificationEvidence(root).file, "{ broken");
  assert.equal(conclude(root).verification, "unverified");
  await runTestTarget(root, LOYALTY_TARGET);
  assert.equal(readVerificationEvidence(root).status, "ok");
  assert.equal(conclude(root).verification, "verified");
});

test("metrics separate traceability from executable verification coverage", async () => {
  const root = project();
  await runTestTarget(root, LOYALTY_TARGET);
  const metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.deepEqual(metrics.evidence, { freshPassed: 1, freshFailed: 0, stale: 0 });
  assert.equal(metrics.rulesWithCompletePath, 1);
  assert.deepEqual(metrics.verification, { verified: 1, failed: 0, stale: 0, unverified: 1 });
  setExit(root, 1);
  await runTestTarget(root, LOYALTY_TARGET);
  assert.deepEqual(traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root)).evidence, { freshPassed: 0, freshFailed: 1, stale: 0 });
});

test("`spectra verify --test-target` runs, records and reports; its exit code follows the result", async () => {
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

test("without the flag `spectra verify` does not execute tests or touch evidence", async () => {
  const root = project();
  run(root, ["verify"]);
  assert.equal(readVerificationEvidence(root).status, "missing");
});

test("a project with no Governs and no evidence stays valid and unverified", async () => {
  const root = project();
  fs.writeFileSync(rulesFile(root), fs.readFileSync(rulesFile(root), "utf8").replace("Governs: alpha#FR-1\n", ""));
  touch(rulesFile(root));
  assert.equal((await runTestTarget(root, LOYALTY_TARGET)).recorded, true);
  assert.equal(conclude(root).verification, "unverified");
});

// ---- review findings on the producer ------------------------------------------------------------

test("--test-target cannot be combined with --scope or --item and runs nothing then", async () => {
  const root = project();
  for (const extra of [["--scope", "app"], ["--item", "ITEM-1"]]) {
    const result = run(root, ["verify", "--test-target", LOYALTY_TARGET, ...extra]);
    assert.equal(result.status, 1, extra.join(" "));
    assert.match(`${result.stdout}${result.stderr}`, /cannot be combined/i);
  }
  assert.equal(readVerificationEvidence(root).status, "missing");
});

test("fan-out commands of common monorepo tools are recorded as aggregate, a plain command as exact", async () => {
  const root = project();
  const granularityFor = async (command) => {
    write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"], scripts: { test: command } }));
    assert.equal(run(root, ["index"]).status, 0);
    assert.equal((await runTestTarget(root, "node:test-target:.")).recorded, true, command);
    return readVerificationEvidence(root).records.find((record) => record.testTarget === "node:test-target:.").granularity;
  };
  for (const command of ["echo pnpm -r test", "echo pnpm --recursive test", "echo lerna run test", "echo turbo run test", "echo nx run-many -t test", "echo yarn workspaces foreach run test", "echo npm run test --workspaces", "echo npm test -ws"]) {
    assert.equal(await granularityFor(command), "aggregate", command);
  }
  assert.equal(await granularityFor("node -e \"process.exit(0)\""), "test-target");
});

test("a timeout stops the whole process group, grandchildren included", async () => {
  const root = project();
  const marker = path.join(root, "grandchild-ran.txt");
  write(path.join(root, "packages", "loyalty", "child.js"), `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'x'), 1200);\n`);
  write(path.join(root, "packages", "loyalty", "check.js"), "require('child_process').spawn(process.execPath, [require('path').join(__dirname, 'child.js')], { stdio: 'ignore' });\nsetTimeout(() => {}, 60000);\n");
  const outcome = await runTestTarget(root, LOYALTY_TARGET, { timeoutMs: 400 });
  assert.equal(outcome.recorded, false);
  assert.match(outcome.reason, /timed out/i);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  assert.equal(fs.existsSync(marker), false, "the grandchild outlived the timeout");
});

test("recording takes a lock: a held lock blocks a second writer, a stale lock is taken over, the lock is always released", async () => {
  const root = project();
  const file = readVerificationEvidence(root).file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  fs.writeFileSync(lock, "another run");
  assert.throws(() => recordVerificationEvidence(root, { testTarget: LOYALTY_TARGET, result: "passed", lockTimeoutMs: 200 }), /locked/i);
  assert.equal(readVerificationEvidence(root).status, "missing", "nothing was written while the lock was held");
  const old = new Date(Date.now() - 10 * 60 * 1000);
  fs.utimesSync(lock, old, old);
  recordVerificationEvidence(root, { testTarget: LOYALTY_TARGET, result: "passed", lockTimeoutMs: 200 });
  assert.equal(readVerificationEvidence(root).records.length, 1);
  assert.equal(fs.existsSync(lock), false, "lock released after the write");
});

test("a run whose lock was taken over never deletes the new owner's lock when it finishes", async () => {
  const root = project();
  const file = readVerificationEvidence(root).file;
  const lock = `${file}.lock`;
  withEvidenceLock(file, () => {
    fs.rmSync(lock, { force: true });
    fs.writeFileSync(lock, "another owner");
  });
  assert.equal(fs.readFileSync(lock, "utf8"), "another owner", "released a lock it no longer owned");
});

test("a test command that leaves a background process holding its output still completes and records", async () => {
  const root = project();
  write(path.join(root, "packages", "loyalty", "check.js"), "require('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 4000)'], { stdio: 'inherit' }).unref();\n");
  const started = Date.now();
  const outcome = await runTestTarget(root, LOYALTY_TARGET, { timeoutMs: 20000 });
  assert.equal(outcome.recorded, true, outcome.reason);
  assert.equal(outcome.result, "passed");
  assert.ok(Date.now() - started < 3500, "waited for the leaked process instead of the command's own exit");
});
