// Phase 1J — controlled verification gates and convergence. Failure modes this file exists to catch
//  (written before the code):
//  - FR verified while a covering AC is failed/stale/unverified, or FR/AC inheriting each other's scope
//  - implementation blocked by verification (deadlocking the repair), or verification auto-granting approval
//  - review/release allowed with failed, stale or declared-but-unexecuted required evidence
//  - missing modeled coverage treated as verified, or as a blocker (a warning, distinct from "scope declared, no evidence")
//  - unrelated failing evidence blocking a deterministically unrelated review scope
//  - gate output that is opaque, non-deterministic, or tells no one what to rerun
//  - plain `spectra verify` running tests, or a second release gate implementation
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
import { evaluateGate, rulesForChangedFiles } from "../src/lib/traceability/gates.js";
import { runTestTarget } from "../src/lib/traceability/run.js";
import { validateBusinessContext } from "../src/lib/business/validator.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const sdd = (root) => path.join(root, ".spectra", "sdd");
const specFile = (root) => path.join(sdd(root), "features", "alpha", "feature.spec.yaml");
const LOY = "node:test-target:packages/loyalty";
const BIL = "node:test-target:packages/billing";

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function spec({ fr1 = [LOY], inv1 = [], ac1 = [LOY], fr2 = [], acs = null } = {}) {
  const scoped = (ids) => (ids.length > 0 ? { verifiedBy: ids } : {});
  return {
    apiVersion: "spectra/v2", kind: "FeatureSpec", metadata: { id: "alpha", name: "Alpha", version: "0.1.0", owner: "product", status: "draft" },
    summary: { problem: "p", outcome: "o" }, scope: { in: ["a"], out: ["b"] },
    requirements: { functional: [
      { id: "FR-1", statement: "Expired points cannot pay.", priority: "must", ...scoped(fr1) },
      { id: "FR-2", statement: "Totals round half up.", priority: "must", ...scoped(fr2) }
    ], nonFunctional: [] },
    invariants: [{ id: "INV-1", statement: "Caches are derived.", ...scoped(inv1) }],
    acceptance: { scenarios: acs ?? [{ id: "AC-1", covers: ["FR-1"], given: "g", when: "w", then: "t", ...scoped(ac1) }] },
    dependencies: []
  };
}

function commitAll(root) {
  const git = (...args) => assert.equal(spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root }).status, 0);
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");
}

// loyalty (always has a test target; exit.txt decides its status) and billing (test target optional).
function project({ billingTests = true, governsBoth = false, ...scopes } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-semantics-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node check.js" } }));
  write(path.join(root, "packages", "loyalty", "check.js"), "process.exit(Number(require('fs').readFileSync(__dirname + '/exit.txt', 'utf8')));\n");
  write(path.join(root, "packages", "loyalty", "exit.txt"), "0");
  write(path.join(root, "packages", "billing", "package.json"), JSON.stringify({ name: "billing", ...(billingTests ? { scripts: { test: "node check.js" } } : {}) }));
  write(path.join(root, "packages", "billing", "check.js"), "process.exit(Number(require('fs').readFileSync(__dirname + '/exit.txt', 'utf8')));\n");
  write(path.join(root, "packages", "billing", "exit.txt"), "0");
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "", "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| loyalty-api | Loyalty | packages/loyalty/ | loyalty |", "| billing | Billing | packages/billing/ | loyalty |", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "INDEX.md"), [
    "# Business Domain Index", "", "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| loyalty | points | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "rules.md"), [
    "# Rules", "",
    "## RULE-LOY-001 — Expiration", "", "Expired points cannot pay for orders.", "", "Status: active", `Affected Modules: ${governsBoth ? "loyalty-api, billing" : "loyalty-api"}`, "Governs: alpha#FR-1", "",
    "## RULE-LOY-002 — Rounding", "", "Totals round half up.", "", "Status: active", "Affected Modules: billing", "Governs: alpha#FR-2", "",
    "## RULE-LOY-003 — Derived caches", "", "Caches never hold the only copy.", "", "Status: active", "Affected Modules: loyalty-api", "Governs: alpha#INV-1", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "unresolved.md"), "# U\n");
  write(specFile(root), YAML.stringify(spec(scopes)));
  assert.equal(run(root, ["index"]).status, 0);
  commitAll(root);
  return root;
}


const setExit = (root, pkg, code) => write(path.join(root, "packages", pkg, "exit.txt"), String(code));
const conclude = (root, id) => concludeVerification(buildTraceability(root), readVerificationEvidence(root), id);
const gate = (root, stage, rules = null) => evaluateGate(buildTraceability(root), readVerificationEvidence(root), stage, { rules });
const verifyTarget = (root, target) => runTestTarget(root, target);
const editSpec = (root, change) => {
  const edited = YAML.parse(fs.readFileSync(specFile(root), "utf8"));
  change(edited);
  write(specFile(root), YAML.stringify(edited));
};
const codes = (items) => items.map((item) => item.code);

// ---- FR / AC aggregation (product decision) ------------------------------------------------------------

test("FR own scope pass and every covering AC verified => FR verified, and so is the rule", async () => {
  const root = project({ fr1: [LOY], ac1: [BIL] });
  await verifyTarget(root, LOY);
  assert.equal(conclude(root, "alpha#FR-1").verification, "unverified", "the AC's scope has no evidence yet");
  await verifyTarget(root, BIL);
  const fr = conclude(root, "alpha#FR-1");
  assert.equal(fr.verification, "verified", JSON.stringify(fr));
  assert.equal(conclude(root, "RULE-LOY-001").verification, "verified");
});

test("FR own scope pass but a covering AC failed => FR failed", async () => {
  const root = project({ fr1: [LOY], ac1: [BIL] });
  setExit(root, "billing", 1);
  await verifyTarget(root, LOY);
  await verifyTarget(root, BIL);
  const fr = conclude(root, "alpha#FR-1");
  assert.equal(fr.verification, "failed");
  assert.match(fr.reason, /alpha#AC-1/);
  assert.equal(conclude(root, "alpha#AC-1").verification, "failed");
});

test("FR own scope pass but a covering AC stale => FR stale; a stronger failure still dominates", async () => {
  const root = project({ fr1: [LOY], ac1: [BIL] });
  await verifyTarget(root, LOY);
  await verifyTarget(root, BIL);
  editSpec(root, (spec) => { spec.acceptance.scenarios[0].then = "credits drop twice"; });
  assert.equal(conclude(root, "alpha#FR-1").verification, "stale");
  setExit(root, "loyalty", 1);
  await verifyTarget(root, LOY);
  assert.equal(conclude(root, "alpha#FR-1").verification, "failed", "FR own scope failed fresh, AC is stale: failed > stale");
});

test("FR own scope pass but a covering AC unverified (no evidence, or no scope modeled) => FR unverified", async () => {
  const noEvidence = project({ fr1: [LOY], ac1: [BIL] });
  await verifyTarget(noEvidence, LOY);
  assert.equal(conclude(noEvidence, "alpha#FR-1").verification, "unverified");
  const noScope = project({ fr1: [LOY], ac1: [] });
  await verifyTarget(noScope, LOY);
  const fr = conclude(noScope, "alpha#FR-1");
  assert.equal(fr.verification, "unverified");
  assert.ok(fr.gaps.some((gap) => /alpha#AC-1.*verification scope/.test(gap)), JSON.stringify(fr.gaps));
});

test("FR does not inherit an AC's scope and an AC does not inherit the FR's", async () => {
  const root = project({ fr1: [], ac1: [LOY] });
  await verifyTarget(root, LOY);
  assert.equal(conclude(root, "alpha#AC-1").verification, "verified");
  assert.equal(conclude(root, "alpha#FR-1").verification, "unverified", "no own scope: not modeled, even though its AC is verified");
  const other = project({ fr1: [LOY], ac1: [] });
  await verifyTarget(other, LOY);
  assert.equal(conclude(other, "alpha#AC-1").verification, "unverified");
});

test("an FR with no covering AC depends only on its own scope", async () => {
  const root = project({ fr2: [BIL] });
  await verifyTarget(root, BIL);
  assert.equal(conclude(root, "alpha#FR-2").verification, "verified");
});

test("a rule is not verified while one of its governed FR's covering ACs is stale, failed or unverified", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY] });
  await verifyTarget(root, LOY);
  assert.equal(conclude(root, "RULE-LOY-001").verification, "verified");
  editSpec(root, (spec) => { spec.acceptance.scenarios[0].then = "changed"; });
  assert.equal(conclude(root, "RULE-LOY-001").verification, "stale");
  const second = project({ fr1: [LOY], ac1: [] });
  await verifyTarget(second, LOY);
  assert.equal(conclude(second, "RULE-LOY-001").verification, "unverified");
});

// ---- Stage gates ---------------------------------------------------------------------------------------

test("implementation is always allowed: stale, failed and missing evidence never block the edit that repairs them", async () => {
  const root = project();
  assert.equal(gate(root, "implementation").status, "allowed", "missing evidence");
  setExit(root, "loyalty", 1);
  await verifyTarget(root, LOY);
  assert.equal(gate(root, "implementation").status, "allowed", "failed evidence");
  setExit(root, "loyalty", 0);
  await verifyTarget(root, LOY);
  editSpec(root, (spec) => { spec.requirements.functional[0].statement = "changed"; });
  const implementation = gate(root, "implementation");
  assert.equal(implementation.status, "allowed", "stale evidence");
  assert.deepEqual(implementation.blockers, []);
  assert.ok(codes(implementation.warnings).includes("stale-evidence"), "the state is still explained");
});

test("review is blocked by a declared required scope with no evidence, and the blocker says what to rerun", () => {
  const root = project();
  const review = gate(root, "review");
  assert.equal(review.status, "blocked");
  const blocker = review.blockers.find((entry) => entry.code === "required-scope-no-evidence" && entry.rule === "RULE-LOY-001" && entry.subject === "alpha#FR-1");
  assert.ok(blocker, JSON.stringify(review.blockers));
  assert.equal(blocker.subject, "alpha#FR-1");
  assert.equal(blocker.scope, LOY);
  assert.match(blocker.action, /spectra verify --test-target node:test-target:packages\/loyalty/);
});

test("review is blocked by failed and by stale required evidence and reopens after the rerun passes", async () => {
  const root = project();
  setExit(root, "loyalty", 1);
  await verifyTarget(root, LOY);
  let review = gate(root, "review", ["RULE-LOY-001"]);
  assert.equal(review.status, "blocked");
  assert.ok(codes(review.blockers).includes("failed-evidence"));
  setExit(root, "loyalty", 0);
  await verifyTarget(root, LOY);
  assert.equal(gate(root, "review", ["RULE-LOY-001"]).status, "allowed");
  editSpec(root, (spec) => { spec.requirements.functional[0].statement = "changed again"; });
  review = gate(root, "review", ["RULE-LOY-001"]);
  assert.equal(review.status, "blocked");
  assert.ok(codes(review.blockers).includes("stale-evidence"));
  await verifyTarget(root, LOY);
  assert.equal(gate(root, "review", ["RULE-LOY-001"]).status, "allowed");
});

test("release is blocked by stale and by failed required evidence and allowed after convergence", async () => {
  const root = project({ fr2: [BIL] });
  await verifyTarget(root, LOY);
  await verifyTarget(root, BIL);
  assert.equal(gate(root, "release").status, "allowed", JSON.stringify(gate(root, "release")));
  editSpec(root, (spec) => { spec.requirements.functional[1].statement = "Totals round half down."; });
  const stale = gate(root, "release");
  assert.equal(stale.status, "blocked");
  assert.ok(stale.blockers.some((entry) => entry.code === "stale-evidence" && entry.subject === "alpha#FR-2"));
  await verifyTarget(root, BIL);
  assert.equal(gate(root, "release").status, "allowed");
  setExit(root, "billing", 1);
  await verifyTarget(root, BIL);
  const failed = gate(root, "release");
  assert.equal(failed.status, "blocked");
  assert.ok(failed.blockers.some((entry) => entry.code === "failed-evidence" && entry.scope === BIL));
});

test("no verification scope modeled is a warning, never a structural failure or a blocker", () => {
  const root = project({ fr1: [], ac1: [] });
  assert.deepEqual(validateBusinessContext(root), []);
  for (const stage of ["implementation", "review", "release"]) {
    const result = gate(root, stage);
    assert.equal(result.status, "allowed", stage);
    assert.ok(stage === "implementation" || codes(result.warnings).includes("coverage-not-modeled"), stage);
  }
});

test("a module without a test target stays a warning, distinct from a modeled scope with no evidence", async () => {
  const root = project({ billingTests: false, fr1: [], ac1: [], fr2: [LOY] });
  await verifyTarget(root, LOY);
  const release = gate(root, "release");
  assert.equal(release.status, "allowed");
  assert.ok(release.warnings.some((entry) => entry.code === "module-without-test-target" && entry.rule === "RULE-LOY-002"), JSON.stringify(release.warnings));
});

test("a rule governing nothing is a missing-canonical-subject warning, not a blocker", () => {
  const root = project({ fr1: [], ac1: [] });
  const rulesPath = path.join(sdd(root), "memory-bank", "business", "loyalty", "rules.md");
  write(rulesPath, fs.readFileSync(rulesPath, "utf8").replace("Governs: alpha#FR-2\n", ""));
  const release = gate(root, "release");
  assert.equal(release.status, "allowed");
  assert.ok(release.warnings.some((entry) => entry.code === "missing-canonical-subject" && entry.rule === "RULE-LOY-002"));
});

test("a broken canonical verification target fails validation and blocks review and release, never implementation", () => {
  const root = project({ fr1: ["node:test-target:packages/nope"], ac1: [] });
  assert.ok(validateBusinessContext(root).some((error) => /does not exist/.test(error)));
  assert.equal(gate(root, "implementation").status, "allowed");
  for (const stage of ["review", "release"]) {
    const result = gate(root, stage);
    assert.equal(result.status, "blocked", stage);
    assert.ok(codes(result.blockers).includes("broken-canonical-structure"), stage);
  }
});

test("review scope follows the changed files: unrelated failing evidence does not block, related does", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY], fr2: [BIL], inv1: [] });
  setExit(root, "billing", 1);
  await verifyTarget(root, LOY);
  await verifyTarget(root, BIL);
  commitAll(root);
  write(path.join(root, "packages", "loyalty", "extra.js"), "module.exports = 1;\n");
  const scoped = run(root, ["verify", "--gate", "review", "--changed", "--json"]);
  const result = JSON.parse(scoped.stdout);
  assert.equal(scoped.status, 0, scoped.stdout + scoped.stderr);
  assert.equal(result.status, "allowed");
  assert.deepEqual(result.scope.rules, ["RULE-LOY-001", "RULE-LOY-003"], "billing-only RULE-LOY-002 stays out of a loyalty-only change");
  const wide = JSON.parse(run(root, ["verify", "--gate", "review", "--json"]).stdout);
  assert.equal(wide.status, "blocked", "project-wide review sees the failing billing scope");
  assert.equal(wide.scope.kind, "project");
  write(path.join(root, "packages", "billing", "extra.js"), "module.exports = 1;\n");
  const related = run(root, ["verify", "--gate", "review", "--changed", "--json"]);
  assert.equal(related.status, 1);
  assert.ok(JSON.parse(related.stdout).blockers.some((entry) => entry.rule === "RULE-LOY-002"));
});

test("gate evaluation is deterministic: repeated runs give identical status, blockers, warnings and order", async () => {
  const root = project({ fr2: [BIL] });
  await verifyTarget(root, LOY);
  const first = JSON.stringify([gate(root, "review"), gate(root, "release"), gate(root, "implementation")]);
  assert.equal(JSON.stringify([gate(root, "review"), gate(root, "release"), gate(root, "implementation")]), first);
  assert.equal(run(root, ["verify", "--gate", "release", "--json"]).stdout, run(root, ["verify", "--gate", "release", "--json"]).stdout);
});

// ---- Convergence (real executions) -----------------------------------------------------------------------

test("convergence: verified -> semantic change -> stale -> implementation allowed, review/release blocked -> rerun -> allowed again", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY] });
  await verifyTarget(root, LOY);
  const stages = ["implementation", "review", "release"];
  const state = () => Object.fromEntries(stages.map((stage) => [stage, gate(root, stage, ["RULE-LOY-001"]).status]));
  assert.deepEqual(state(), { implementation: "allowed", review: "allowed", release: "allowed" });
  editSpec(root, (spec) => { spec.requirements.functional[0].statement = "Expired points cannot pay, even partially."; });
  assert.equal(conclude(root, "RULE-LOY-001").verification, "stale");
  assert.deepEqual(state(), { implementation: "allowed", review: "blocked", release: "blocked" });
  const before = fs.readFileSync(readVerificationEvidence(root).file, "utf8");
  assert.equal(fs.readFileSync(readVerificationEvidence(root).file, "utf8"), before, "evaluating gates never reruns tests");
  const outcome = await verifyTarget(root, LOY);
  assert.equal(outcome.result, "passed");
  assert.deepEqual(state(), { implementation: "allowed", review: "allowed", release: "allowed" });
  assert.equal(conclude(root, "RULE-LOY-001").verification, "verified");
});

test("failure recovery: verified -> change -> rerun fails -> gates block -> fix -> rerun passes -> gates reopen", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY] });
  await verifyTarget(root, LOY);
  assert.equal(gate(root, "release", ["RULE-LOY-001"]).status, "allowed");
  setExit(root, "loyalty", 1);
  const failed = await verifyTarget(root, LOY);
  assert.equal(failed.result, "failed");
  assert.equal(gate(root, "implementation").status, "allowed");
  assert.equal(gate(root, "review", ["RULE-LOY-001"]).status, "blocked");
  assert.equal(gate(root, "release", ["RULE-LOY-001"]).status, "blocked");
  setExit(root, "loyalty", 0);
  assert.equal(gate(root, "release", ["RULE-LOY-001"]).status, "blocked", "fixing is not enough: the result must be re-recorded");
  await verifyTarget(root, LOY);
  assert.equal(gate(root, "review", ["RULE-LOY-001"]).status, "allowed");
  assert.equal(gate(root, "release", ["RULE-LOY-001"]).status, "allowed");
});

test("release convergence never grants approval: verification satisfied leaves the approval state untouched", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY] });
  const approvalFile = path.join(sdd(root), "governance", "approval-state.yaml");
  const approvalBefore = fs.readFileSync(approvalFile, "utf8");
  await verifyTarget(root, LOY);
  assert.equal(gate(root, "release", ["RULE-LOY-001"]).status, "allowed");
  editSpec(root, (spec) => { spec.requirements.functional[0].statement = "changed"; });
  assert.equal(gate(root, "release", ["RULE-LOY-001"]).status, "blocked");
  await verifyTarget(root, LOY);
  assert.equal(gate(root, "release", ["RULE-LOY-001"]).status, "allowed");
  assert.equal(fs.readFileSync(approvalFile, "utf8"), approvalBefore, "verification must not change or grant any approval");
});

// ---- Surfaces --------------------------------------------------------------------------------------------

test("`spectra verify --gate` explains blockers in human form, exits 1 only when blocked, and rejects bad combinations", async () => {
  const root = project();
  const blocked = run(root, ["verify", "--gate", "review"]);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /Review gate: blocked/i);
  assert.match(blocked.stdout, /RULE-LOY-001/);
  assert.match(blocked.stdout, /alpha#FR-1/);
  assert.match(blocked.stdout, /spectra verify --test-target node:test-target:packages\/loyalty/);
  const implementation = run(root, ["verify", "--gate", "implementation"]);
  assert.equal(implementation.status, 0);
  assert.match(implementation.stdout, /allowed/i);
  assert.notEqual(run(root, ["verify", "--gate", "nonsense"]).status, 0);
  assert.notEqual(run(root, ["verify", "--gate", "review", "--test-target", LOY]).status, 0);
  assert.notEqual(run(root, ["verify", "--gate", "release", "--changed"]).status, 0, "release is project-wide by design");
  await verifyTarget(root, LOY);
  await verifyTarget(root, BIL);
});

test("`spectra verify` surfaces the release gate as a verification stage and never runs tests itself", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY] });
  // give the fixture feature the rest of a bundle (evals, telemetry, ...) so the other verify stages can run
  const features = path.join(sdd(root), "features");
  for (const file of fs.readdirSync(path.join(features, "spectra-core"), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && entry.name !== "feature.spec.yaml")) {
    const relative = path.relative(path.join(features, "spectra-core"), path.join(file.parentPath, file.name));
    write(path.join(features, "alpha", relative), fs.readFileSync(path.join(file.parentPath, file.name), "utf8").replaceAll("spectra-core", "alpha"));
  }
  const stage = (out) => out.split("\n").find((line) => /verification:/.test(line)) ?? "";
  const first = run(root, ["verify"]);
  assert.match(stage(first.stdout), /^FAIL verification/, `declared scope without evidence blocks release readiness\n${first.stdout}${first.stderr}`);
  assert.equal(fs.existsSync(readVerificationEvidence(root).file), false, "plain verify executed nothing");
  await verifyTarget(root, LOY);
  setExit(root, "billing", 1);
  assert.doesNotMatch(stage(run(root, ["verify"]).stdout), /^FAIL/, "RULE-LOY-002 declares no scope, so only a warning remains");
});

test("legacy projects without Governs, verifiedBy or invariants stay usable and get warnings only", () => {
  const root = project({ fr1: [], ac1: [] });
  const rulesPath = path.join(sdd(root), "memory-bank", "business", "loyalty", "rules.md");
  write(rulesPath, fs.readFileSync(rulesPath, "utf8").replace(/Governs: .*\n/g, ""));
  assert.deepEqual(validateBusinessContext(root), []);
  for (const stage of ["implementation", "review", "release"]) assert.equal(gate(root, stage).status, "allowed", stage);
});

test("metrics count required subjects by conclusion and the rules each stage gate blocks", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY], fr2: [BIL] });
  let metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.deepEqual(metrics.verificationRequired, { subjects: 2, verified: 0, failed: 0, stale: 0, unverified: 2 });
  assert.deepEqual(metrics.rulesBlocked, { review: 2, release: 2 });
  await verifyTarget(root, LOY);
  setExit(root, "billing", 1);
  await verifyTarget(root, BIL);
  metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.deepEqual(metrics.verificationRequired, { subjects: 2, verified: 1, failed: 1, stale: 0, unverified: 0 });
  assert.deepEqual(metrics.rulesBlocked, { review: 1, release: 1 });
});

test("a broken verifiedBy on a covering AC (or on a subject no rule governs) still blocks a project-wide gate", () => {
  const acOnly = project({ fr1: [LOY], ac1: ["node:test-target:packages/nope"] });
  for (const stage of ["review", "release"]) assert.ok(gate(acOnly, stage).blockers.some((entry) => entry.code === "broken-canonical-structure" && entry.subject === "alpha#AC-1" && entry.rule === "RULE-LOY-001"), stage);
  const ungoverned = project({ fr1: [LOY], ac1: [LOY] });
  editSpec(ungoverned, (spec) => { spec.requirements.functional.push({ id: "FR-9", statement: "Orphan.", priority: "must", verifiedBy: ["node:test-target:packages/nope"] }); });
  const release = gate(ungoverned, "release");
  assert.ok(release.blockers.some((entry) => entry.code === "broken-canonical-structure" && entry.subject === "alpha#FR-9" && entry.rule === null), JSON.stringify(release.blockers));
  assert.equal(gate(ungoverned, "review", ["RULE-LOY-001"]).blockers.some((entry) => entry.subject === "alpha#FR-9"), false, "a narrowed review only sees edges its rules reach");
});

test("root-module files concern the rules that affect the root module, and only files no other module owns", () => {
  const trace = {
    subjects: { "RULE-A": { kind: "business-rule", status: "active" }, "RULE-B": { kind: "business-rule", status: "active" } },
    edges: [{ type: "affectsModule", from: "RULE-A", to: "node:module:." }, { type: "affectsModule", from: "RULE-B", to: "node:module:packages/b" }],
    locators: { modules: { "node:module:.": ".", "node:module:packages/b": "packages/b" }, sources: {} }
  };
  assert.deepEqual(rulesForChangedFiles(trace, ["package.json"]), ["RULE-A"]);
  assert.deepEqual(rulesForChangedFiles(trace, ["packages/b/index.js"]), ["RULE-B"], "a file owned by another module is not a root-module change");
  assert.deepEqual(rulesForChangedFiles(trace, ["packages/b/index.js", "README.md"]), ["RULE-A", "RULE-B"]);
});

test("a narrowed gate whose changed files concern no rule says so explicitly instead of passing silently", () => {
  const root = project();
  const result = JSON.parse(run(root, ["verify", "--gate", "review", "--changed", "--json"]).stdout);
  assert.equal(result.status, "allowed");
  assert.deepEqual(result.scope.rules, []);
  assert.ok(result.warnings.some((entry) => entry.code === "no-rules-in-scope"), JSON.stringify(result.warnings));
  assert.match(run(root, ["verify", "--gate", "review", "--changed"]).stdout, /no-rules-in-scope/);
  assert.notEqual(run(root, ["verify", "--gate", "review", "--head", "HEAD"]).status, 0, "--head without --base is rejected");
});

test("a blocked release gate lowers the release confidence score", async () => {
  const root = project({ fr1: [LOY], ac1: [LOY] });
  const features = path.join(sdd(root), "features");
  for (const file of fs.readdirSync(path.join(features, "spectra-core"), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && entry.name !== "feature.spec.yaml")) {
    const relative = path.relative(path.join(features, "spectra-core"), path.join(file.parentPath, file.name));
    write(path.join(features, "alpha", relative), fs.readFileSync(path.join(file.parentPath, file.name), "utf8").replaceAll("spectra-core", "alpha"));
  }
  const score = (out) => Number(out.match(/Release confidence score: (\d+)\/100/)[1]);
  const blocked = score(run(root, ["verify"]).stdout);
  await verifyTarget(root, LOY);
  assert.ok(score(run(root, ["verify"]).stdout) > blocked, "verification evidence must show in the score, not only in the verdict");
});
