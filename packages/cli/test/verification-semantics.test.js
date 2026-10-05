// Phase 1I — verification semantics. Failure modes this file exists to catch (written before the code):
//  - a rule over several modules becoming `verified` while one required module has no evidence, or
//    one passing path hiding a failed or stale one
//  - a module's test target silently verifying every requirement connected through that module
//  - an aggregate result being distributed over subjects that never named it as their scope
//  - a requirement/invariant concluding `verified` without an explicit `verifiedBy` scope
//  - "no scope / no test" being reported as `failed`, or a failed scope as "the requirement is false"
//  - a bad `verifiedBy` (missing id, wrong kind, duplicate, bad syntax, self-link) passing validation
//  - an invariant (non-FR subject) not resolving as a governed canonical subject
//  - gate classification treating a coverage gap like a failure, or blocking edits because tests fail
//  - `verify --explain` hiding the missing layer, or writing anything
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
import { evaluateGates } from "../src/lib/traceability/gates.js";
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

function spec({ fr1 = [LOY], inv1 = [LOY], ac1 = [] } = {}) {
  const scoped = (ids) => (ids.length > 0 ? { verifiedBy: ids } : {});
  return {
    apiVersion: "spectra/v2", kind: "FeatureSpec", metadata: { id: "alpha", name: "Alpha", version: "0.1.0", owner: "product", status: "draft" },
    summary: { problem: "p", outcome: "o" }, scope: { in: ["a"], out: ["b"] },
    requirements: { functional: [
      { id: "FR-1", statement: "Expired points cannot pay.", priority: "must", ...scoped(fr1) },
      { id: "FR-2", statement: "Totals round half up.", priority: "must" }
    ], nonFunctional: [] },
    invariants: [{ id: "INV-1", statement: "Caches are derived.", ...scoped(inv1) }],
    acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "g", when: "w", then: "t", ...scoped(ac1) }] },
    dependencies: []
  };
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
    "## RULE-LOY-002 — Rounding", "", "Totals round half up.", "", "Status: active", "Affected Modules: loyalty-api", "Governs: alpha#FR-2", "",
    "## RULE-LOY-003 — Derived caches", "", "Caches never hold the only copy.", "", "Status: active", "Affected Modules: loyalty-api", "Governs: alpha#INV-1", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "unresolved.md"), "# U\n");
  write(specFile(root), YAML.stringify(spec(scopes)));
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

const setExit = (root, pkg, code) => write(path.join(root, "packages", pkg, "exit.txt"), String(code));
const conclude = (root, id) => concludeVerification(buildTraceability(root), readVerificationEvidence(root), id);
const verifyTarget = (root, target) => runTestTarget(root, target);

test("multi-module: one passing path and one module without a test target is not verified, and the gap is named", async () => {
  const root = project({ billingTests: false, governsBoth: true, fr1: [LOY] });
  await verifyTarget(root, LOY);
  const rule = conclude(root, "RULE-LOY-001");
  assert.equal(rule.verification, "unverified");
  assert.ok(rule.gaps.some((gap) => /billing/.test(gap) && /no test target/.test(gap)), JSON.stringify(rule.gaps));
  assert.equal(conclude(root, "alpha#FR-1").verification, "verified", "the subject's own scope did pass; the rule is what stays incomplete");
});

test("multi-module: a module with a test target that no governed subject names as scope is a visible gap", async () => {
  const root = project({ governsBoth: true, fr1: [LOY] });
  await verifyTarget(root, LOY);
  const rule = conclude(root, "RULE-LOY-001");
  assert.equal(rule.verification, "unverified");
  assert.ok(rule.gaps.some((gap) => /billing/.test(gap) && /verification scope/.test(gap)), JSON.stringify(rule.gaps));
});

test("multi-module: every required path passing fresh makes the rule verified", async () => {
  const root = project({ governsBoth: true, fr1: [LOY, BIL] });
  await verifyTarget(root, LOY);
  assert.equal(conclude(root, "RULE-LOY-001").verification, "unverified", "one of two required scopes has no evidence yet");
  await verifyTarget(root, BIL);
  const rule = conclude(root, "RULE-LOY-001");
  assert.equal(rule.verification, "verified", JSON.stringify(rule));
  assert.deepEqual(rule.gaps, []);
});

test("one required path failed dominates a passing one and is reported as a failed scope, not a false requirement", async () => {
  const root = project({ governsBoth: true, fr1: [LOY, BIL] });
  setExit(root, "billing", 1);
  await verifyTarget(root, LOY);
  await verifyTarget(root, BIL);
  const rule = conclude(root, "RULE-LOY-001");
  assert.equal(rule.verification, "failed");
  assert.match(rule.reason, /required verification scope failed/i);
  assert.doesNotMatch(rule.reason, /requirement (is )?(false|incorrect)/i);
});

test("one required path stale (its subject changed after the run) makes the rule stale, not verified", async () => {
  const root = project({ governsBoth: true, fr1: [LOY, BIL] });
  await verifyTarget(root, LOY);
  await verifyTarget(root, BIL);
  assert.equal(conclude(root, "RULE-LOY-001").verification, "verified");
  const edited = YAML.parse(fs.readFileSync(specFile(root), "utf8"));
  edited.requirements.functional[0].statement = "Expired points cannot pay, ever.";
  write(specFile(root), YAML.stringify(edited));
  assert.equal(conclude(root, "RULE-LOY-001").verification, "stale");
  assert.equal(conclude(root, "alpha#FR-1").verification, "stale");
});

test("an explicit verification scope is required: a passing module test alone verifies nothing", async () => {
  const root = project({ fr1: [] });
  await verifyTarget(root, LOY);
  const subject = conclude(root, "alpha#FR-1");
  assert.equal(subject.verification, "unverified");
  assert.match(subject.reason, /verification scope/i);
  assert.equal(conclude(root, "RULE-LOY-001").verification, "unverified");
});

test("no scope or no evidence is `unverified`, never `failed`", async () => {
  const root = project({ fr1: [] });
  assert.equal(conclude(root, "alpha#FR-1").verification, "unverified");
  const scoped = project({ fr1: [LOY] });
  assert.equal(conclude(scoped, "alpha#FR-1").verification, "unverified");
  assert.equal(conclude(scoped, "RULE-LOY-001").verification, "unverified");
});

test("an aggregate result verifies only the subjects that named that target, never the rest of the module", async () => {
  const root = project({ fr1: [LOY] });
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node check.js --workspaces" } }));
  write(path.join(root, "packages", "loyalty", "check.js"), "process.exit(0)\n");
  assert.equal(run(root, ["index"]).status, 0);
  const outcome = await verifyTarget(root, LOY);
  assert.equal(outcome.granularity, "aggregate");
  assert.equal(conclude(root, "alpha#FR-1").verification, "verified");
  assert.equal(conclude(root, "alpha#FR-2").verification, "unverified", "FR-2 shares the module but never named the aggregate target");
  assert.equal(conclude(root, "RULE-LOY-002").verification, "unverified");
});

test("a failing aggregate target that is an explicit scope fails verification without claiming the logic is wrong", async () => {
  const root = project({ fr1: [LOY] });
  setExit(root, "loyalty", 3);
  await verifyTarget(root, LOY);
  const subject = conclude(root, "alpha#FR-1");
  assert.equal(subject.verification, "failed");
  assert.match(subject.reason, /required verification scope failed/i);
});

test("an AC verifies through its own scope only; the requirement it covers does not inherit it", async () => {
  const root = project({ fr1: [], ac1: [LOY] });
  await verifyTarget(root, LOY);
  assert.equal(conclude(root, "alpha#AC-1").verification, "verified");
  assert.equal(conclude(root, "alpha#FR-1").verification, "unverified");
});

test("an invariant subject resolves, is governed by a rule and verifies through its explicit scope", async () => {
  const root = project({ inv1: [LOY] });
  const trace = buildTraceability(root);
  assert.equal(trace.subjects["alpha#INV-1"].kind, "architectural-invariant");
  assert.equal(conclude(root, "RULE-LOY-003").verification, "unverified");
  await verifyTarget(root, LOY);
  assert.equal(conclude(root, "alpha#INV-1").verification, "verified");
  assert.equal(conclude(root, "RULE-LOY-003").verification, "verified");
});

test("a rule governing nothing has no canonical subject and is unverified with that gap", async () => {
  const root = project();
  const rulesPath = path.join(sdd(root), "memory-bank", "business", "loyalty", "rules.md");
  write(rulesPath, fs.readFileSync(rulesPath, "utf8").replace("Governs: alpha#FR-2\n", ""));
  const rule = conclude(root, "RULE-LOY-002");
  assert.equal(rule.verification, "unverified");
  assert.ok(rule.gaps.some((gap) => /canonical subject/.test(gap)), JSON.stringify(rule.gaps));
});

test("verifiedBy is validated: missing target, wrong kind, duplicate, bad syntax and self-link are reported; absence is valid", () => {
  assert.deepEqual(validateBusinessContext(project({ fr1: [] })), []);
  assert.deepEqual(validateBusinessContext(project({ fr1: [LOY] })), []);
  const bad = (fr1, pattern) => {
    const errors = validateBusinessContext(project({ fr1 }));
    assert.ok(errors.some((error) => pattern.test(error)), `${JSON.stringify(fr1)} -> ${JSON.stringify(errors)}`);
  };
  bad(["node:test-target:packages/nope"], /alpha#FR-1.*verifiedBy.*does not exist/i);
  bad(["node:module:packages/loyalty"], /alpha#FR-1.*verifiedBy.*not a test target/i);
  bad([LOY, LOY], /alpha#FR-1.*duplicate verifiedBy/i);
  bad(["not an id!"], /alpha#FR-1.*verifiedBy.*syntax/i);
  bad(["alpha#FR-1"], /alpha#FR-1.*verifiedBy.*itself/i);
  bad(["alpha#FR-2"], /alpha#FR-1.*verifiedBy.*not a test target/i);
});

test("a broken verifiedBy edge is a broken canonical edge in the metrics and gates", () => {
  const root = project({ fr1: ["node:test-target:packages/nope"] });
  const trace = buildTraceability(root);
  assert.equal(trace.unresolved.filter((entry) => entry.type === "verifiedBy").length, 1);
  assert.equal(traceabilityMetrics(trace, readVerificationEvidence(root)).brokenEdges, 1);
});

test("metrics keep canonical, scope, execution and verified coverage apart", async () => {
  const root = project({ fr1: [LOY], inv1: [] });
  let metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.equal(metrics.activeRules, 3);
  assert.equal(metrics.rulesWithCanonicalSubject, 3);
  assert.equal(metrics.canonicalSubjects, 3);
  assert.equal(metrics.subjectsWithScope, 1);
  assert.deepEqual(metrics.scopes, { total: 1, freshPassed: 0, freshFailed: 0, stale: 0, noEvidence: 1 });
  assert.equal(metrics.verification.verified, 0);
  await verifyTarget(root, LOY);
  metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.deepEqual(metrics.scopes, { total: 1, freshPassed: 1, freshFailed: 0, stale: 0, noEvidence: 0 });
  assert.equal(metrics.verification.verified, 1, "only the rule whose subject has a passing scope");
  assert.equal(metrics.subjectVerification.verified, 1);
});

test("gate policy is stage specific: structure blocks everywhere, gaps warn, failed/stale block review and release but never editing", async () => {
  const root = project({ fr1: [LOY], inv1: [] });
  const gates = () => evaluateGates(buildTraceability(root), readVerificationEvidence(root));
  assert.deepEqual(gates().implementation.block, []);
  assert.ok(gates().review.warn.includes("missing-verification-scope"));
  assert.ok(gates().release.warn.includes("missing-verification-scope"));
  assert.deepEqual(gates().release.block, [], "a coverage gap alone is not a blocker");
  setExit(root, "loyalty", 1);
  await verifyTarget(root, LOY);
  assert.deepEqual(gates().implementation.block, [], "failing tests must never block the edit that fixes them");
  assert.ok(gates().review.block.includes("failed-evidence") && gates().release.block.includes("failed-evidence"));
  setExit(root, "loyalty", 0);
  await verifyTarget(root, LOY);
  assert.deepEqual(gates().release.block, []);
  const edited = YAML.parse(fs.readFileSync(specFile(root), "utf8"));
  edited.requirements.functional[0].statement = "changed";
  write(specFile(root), YAML.stringify(edited));
  assert.deepEqual(gates().implementation.block, []);
  assert.ok(gates().review.block.includes("stale-evidence") && gates().release.block.includes("stale-evidence"));
  write(specFile(root), YAML.stringify(spec({ fr1: ["node:test-target:packages/nope"] })));
  for (const stage of ["implementation", "review", "release"]) assert.ok(gates()[stage].block.includes("broken-canonical-edge"), stage);
});

test("`spectra verify --explain` names the exact missing layer, supports --json, and writes nothing", async () => {
  const root = project({ billingTests: false, governsBoth: true, fr1: [LOY] });
  await verifyTarget(root, LOY);
  const before = fs.readFileSync(readVerificationEvidence(root).file, "utf8");
  const human = run(root, ["verify", "--explain", "RULE-LOY-001"]);
  assert.equal(human.status, 0, human.stderr + human.stdout);
  assert.match(human.stdout, /RULE-LOY-001: unverified/);
  assert.match(human.stdout, /billing/);
  assert.match(human.stdout, /no test target/);
  const json = JSON.parse(run(root, ["verify", "--explain", "RULE-LOY-001", "--json"]).stdout);
  assert.equal(json.id, "RULE-LOY-001");
  assert.equal(json.verification, "unverified");
  assert.ok(json.gaps.length > 0 && Array.isArray(json.subjects) && Array.isArray(json.scopes));
  assert.equal(fs.readFileSync(readVerificationEvidence(root).file, "utf8"), before);
  assert.notEqual(run(root, ["verify", "--explain", "RULE-NOPE"]).status, 0);
  assert.notEqual(run(root, ["verify", "--explain", "RULE-LOY-001", "--test-target", LOY]).status, 0);
});

test("a project with no verifiedBy anywhere stays valid and reports incomplete verification coverage", () => {
  const root = project({ fr1: [], inv1: [] });
  assert.deepEqual(validateBusinessContext(root), []);
  const metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.equal(metrics.subjectsWithScope, 0);
  assert.equal(metrics.verification.unverified, 3);
});
