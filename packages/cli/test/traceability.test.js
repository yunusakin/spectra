// Phase 1G — traceability contract and verification evidence foundation.
//
// Contract under test
//   canonical intent : a rule's `Governs:` metadata line names feature objects by stable ID
//                      (`<feature-id>#<object-id>`); `Affected Modules:` names modules (already canonical)
//   derived          : reverse index (requirement <- rule), module -> Repo Index module record,
//                      module -> test target (Repo Index), all explained with a reason
//   evidence         : a recorded result for a test target, with the signatures of everything it
//                      supported; a local, disposable cache, never canonical
//   conclusion       : verified | failed | stale | unverified, derived from a complete path plus
//                      fresh evidence; a traceability path alone never verifies anything
//
// Failure modes enumerated BEFORE implementation:
//  - broken target IDs accepted (missing feature, missing object, wrong syntax, a rule or repo-index ID)
//  - duplicate edges (same target declared twice, or a requirement reached directly and through an AC)
//  - the same relationship stored in both directions canonically
//  - identity by file path, heading position or line number
//  - lexical/text similarity creating a canonical edge
//  - Repo Index data copied into the traceability result (paths, ecosystem, evidence)
//  - "module has tests" or "rule has Affected Modules" treated as verified
//  - approval or review state treated as verification
//  - stale evidence still reported as verified (rule, requirement, test target or module mapping changed)
//  - a failed result hidden by an older passing one
//  - missing hops omitted instead of reported
//  - recursion or unbounded walks over `covers`
//  - evidence or map cache corruption failing canonical commands, or a half-written evidence file
//  - non-deterministic output (timestamps, ordering)
//  - existing projects without `Governs` becoming invalid
//  - canonical files modified by tracing or by recording evidence
//  - the new metadata line changing rule lookup terms (retrieval is frozen) or the map contract not rebuilding

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { validateBusinessContext } from "../src/lib/business/validator.js";
import { loadKnowledgeMap } from "../src/lib/knowledge/map.js";
import { buildTraceability, traceSubject, traceabilityMetrics } from "../src/lib/traceability/trace.js";
import { concludeVerification, readVerificationEvidence, recordVerificationEvidence } from "../src/lib/traceability/evidence.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(cliRoot, "..", "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const sdd = (root) => path.join(root, ".spectra", "sdd");
const rulesFile = (root, domain) => path.join(sdd(root), "memory-bank", "business", domain, "rules.md");
const specFile = (root) => path.join(sdd(root), "features", "alpha", "feature.spec.yaml");
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const SPEC = {
  metadata: { id: "alpha" },
  requirements: {
    functional: [{ id: "FR-1", statement: "Customers redeem loyalty credits" }, { id: "FR-2", statement: "Warehouse ships parcels" }],
    nonFunctional: [{ id: "NFR-1", statement: "Redemption answers within a second" }]
  },
  acceptance: {
    scenarios: [
      { id: "AC-1", covers: ["FR-1"], given: "a customer", when: "they redeem", then: "credits drop" },
      { id: "AC-2", covers: ["FR-2"], given: "a parcel", when: "it ships", then: "tracking appears" }
    ]
  }
};

const LOYALTY_RULES = (governs = "Governs: alpha#FR-1") => [
  "# Rules", "",
  "## RULE-LOY-001 — Expiration", "", "Expired points cannot pay for orders.", "", "Status: active", "Affected Modules: loyalty-api", governs, "",
  "## RULE-LOY-002 — Rounding", "", "Totals round half up. Mentions alpha FR-1 loyalty-api in plain text only.", "", "Status: active", ""
].filter((line) => line !== null).join("\n");

// loyalty-api has a test script (-> test target); billing has none.
function project({ governs } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-trace-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node --test" } }));
  write(path.join(root, "packages", "billing", "package.json"), JSON.stringify({ name: "billing" }));
  write(path.join(root, "packages", "loyalty", "src", "index.js"), "export const a = 1;\n");
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "",
    "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| loyalty-api | Loyalty | packages/loyalty/ | loyalty |",
    "| billing | Billing | packages/billing/ | loyalty |", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "INDEX.md"), [
    "# Business Domain Index", "",
    "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| loyalty | points | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |", ""
  ].join("\n"));
  write(rulesFile(root, "loyalty"), LOYALTY_RULES(governs));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "unresolved.md"), "# U\n");
  write(specFile(root), YAML.stringify(SPEC));
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

const edgesOf = (trace, type) => trace.edges.filter((edge) => edge.type === type);
const touch = (file) => { const future = new Date(Date.now() + 5000); fs.utimesSync(file, future, future); };
const editRule = (root, from, to) => { fs.writeFileSync(rulesFile(root, "loyalty"), fs.readFileSync(rulesFile(root, "loyalty"), "utf8").replace(from, to)); touch(rulesFile(root, "loyalty")); };

test("a canonical Governs link becomes a stable-ID edge with a reason, and the reverse is derived", () => {
  const root = project();
  const trace = buildTraceability(root);
  assert.deepEqual(edgesOf(trace, "governs").map(({ from, to, provenance }) => [from, to, provenance]), [["RULE-LOY-001", "alpha#FR-1", "canonical"]]);
  assert.match(edgesOf(trace, "governs")[0].reason, /Governs/);
  const requirement = traceSubject(trace, "alpha#FR-1");
  assert.deepEqual(requirement.governedBy, ["RULE-LOY-001"]);
  assert.ok(!fs.readFileSync(specFile(root), "utf8").includes("RULE-LOY-001"), "reverse direction is never stored canonically");
});

test("identity is the stable ID: every edge endpoint is a rule/feature-object/repo-index ID, never a path", () => {
  const trace = buildTraceability(project());
  for (const edge of trace.edges) for (const id of [edge.from, edge.to]) {
    assert.match(id, /^(RULE-[A-Z0-9-]+|[a-z0-9-]+#[A-Z]+-\d+|node:(module|test-target):.+)$/, `not a stable id: ${id}`);
  }
});

test("rule -> module -> test target uses Repo Index records by ID and does not copy them", () => {
  const trace = buildTraceability(project());
  const rule = traceSubject(trace, "RULE-LOY-001");
  assert.deepEqual(rule.modules.map((module) => module.id), ["node:module:packages/loyalty"]);
  assert.deepEqual(rule.testTargets.map((target) => target.id), ["node:test-target:packages/loyalty"]);
  assert.match(edgesOf(trace, "testedBy")[0].reason, /Repo Index/);
  assert.equal(JSON.stringify(trace).includes("ecosystem"), false, "no Repo Index attributes in the result");
});

test("traversal is bounded: rule -> requirement -> module -> test target, and AC covers is followed one hop only", () => {
  const root = project({ governs: "Governs: alpha#AC-1" });
  const rule = traceSubject(buildTraceability(root), "RULE-LOY-001");
  assert.deepEqual(rule.requirements, ["alpha#FR-1"], "an AC target reaches its covered requirement");
  assert.equal(rule.paths.length, 1);
});

test("the same requirement reached directly and through an AC is one path and one requirement", () => {
  const root = project({ governs: "Governs: alpha#FR-1, alpha#AC-1" });
  const rule = traceSubject(buildTraceability(root), "RULE-LOY-001");
  assert.deepEqual(rule.requirements, ["alpha#FR-1"]);
  assert.equal(rule.paths.length, 1);
});

test("no lexical auto-linking: a rule that only mentions a requirement has no edge", () => {
  const trace = buildTraceability(project());
  assert.deepEqual(traceSubject(trace, "RULE-LOY-002").requirements, []);
  assert.equal(edgesOf(trace, "governs").some((edge) => edge.from === "RULE-LOY-002"), false);
});

test("validation: missing target, bad syntax, non-feature target, duplicates and repeated lines are errors", () => {
  const cases = [
    ["Governs: alpha#FR-999", /RULE-LOY-001.*alpha#FR-999/],
    ["Governs: ghost#FR-1", /RULE-LOY-001.*ghost#FR-1/],
    ["Governs: FR-1", /RULE-LOY-001.*FR-1.*<feature-id>#<object-id>/],
    ["Governs: RULE-LOY-002", /RULE-LOY-001.*RULE-LOY-002/],
    ["Governs: node:module:packages/loyalty", /RULE-LOY-001.*node:module/],
    ["Governs: alpha#FR-1, alpha#FR-1", /RULE-LOY-001.*duplicate.*alpha#FR-1/i],
    ["Governs: alpha#FR-1\nGoverns: alpha#FR-2", /RULE-LOY-001.*more than one Governs/i]
  ];
  for (const [line, pattern] of cases) {
    const errors = validateBusinessContext(project({ governs: line }));
    assert.ok(errors.some((error) => pattern.test(error)), `${line} -> ${JSON.stringify(errors)}`);
  }
  assert.deepEqual(validateBusinessContext(project()), []);
});

test("`spectra validate` reports a broken Governs target and stops", () => {
  const result = run(project({ governs: "Governs: alpha#FR-999" }), ["validate"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /RULE-LOY-001.*alpha#FR-999/);
});

test("traceability path and verification conclusion are distinct: tests existing verify nothing", () => {
  const root = project();
  const trace = buildTraceability(root);
  const conclusion = concludeVerification(trace, readVerificationEvidence(root), "RULE-LOY-001");
  assert.equal(conclusion.traceability.complete, true);
  assert.equal(conclusion.verification, "unverified");
  assert.match(conclusion.reason, /no evidence/i);
});

test("missing hops are reported, never omitted", () => {
  const root = project();
  const trace = buildTraceability(root);
  const noLink = concludeVerification(trace, readVerificationEvidence(root), "RULE-LOY-002");
  assert.deepEqual(noLink.traceability.missing, ["requirement", "module", "test-target"]);
  assert.equal(noLink.verification, "unverified");
  const requirement = concludeVerification(trace, readVerificationEvidence(root), "alpha#FR-2");
  assert.deepEqual(requirement.traceability.missing, ["rule", "module", "test-target"]);
});

test("a module without a test target leaves the path incomplete even with a rule and requirement", () => {
  const root = project();
  editRule(root, "Affected Modules: loyalty-api", "Affected Modules: billing");
  const conclusion = concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001");
  assert.deepEqual(conclusion.traceability.missing, ["test-target"]);
  assert.equal(conclusion.verification, "unverified");
});

test("fresh passing evidence verifies; a failed result wins; evidence for another target does not count", () => {
  const root = project();
  recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" });
  const trace = buildTraceability(root);
  const verified = concludeVerification(trace, readVerificationEvidence(root), "RULE-LOY-001");
  assert.equal(verified.verification, "verified");
  assert.equal(concludeVerification(trace, readVerificationEvidence(root), "alpha#FR-1").verification, "verified");
  assert.equal(concludeVerification(trace, readVerificationEvidence(root), "RULE-LOY-002").verification, "unverified");
  recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "failed", command: "node --test" });
  assert.equal(concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001").verification, "failed");
});

test("recording rejects unknown test targets and results", () => {
  const root = project();
  assert.throws(() => recordVerificationEvidence(root, { testTarget: "node:test-target:nope", result: "passed" }), /test target/i);
  assert.throws(() => recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "ok" }), /result/i);
});

test("evidence goes stale when the rule, the requirement, the test target or the module mapping changes", () => {
  const changes = {
    rule: (root) => editRule(root, "Expired points cannot pay for orders.", "Expired points can pay for orders."),
    requirement: (root) => { write(specFile(root), YAML.stringify({ ...SPEC, requirements: { ...SPEC.requirements, functional: [{ id: "FR-1", statement: "Customers redeem loyalty credits at the till" }, SPEC.requirements.functional[1]] } })); touch(specFile(root)); },
    testTarget: (root) => { write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node --test --watch" } })); assert.equal(run(root, ["index"]).status, 0); },
    moduleMapping: (root) => editRule(root, "Affected Modules: loyalty-api", "Affected Modules: loyalty-api, billing")
  };
  for (const [name, change] of Object.entries(changes)) {
    const root = project();
    recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" });
    assert.equal(concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001").verification, "verified", name);
    change(root);
    const after = concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001");
    assert.equal(after.verification, "stale", `${name} -> ${after.verification}`);
    assert.ok(after.paths.some((entry) => entry.evidence?.fresh === false), `${name}: stale evidence is visible`);
  }
});

test("an unrelated edit does not stale the evidence", () => {
  const root = project();
  recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" });
  editRule(root, "Totals round half up.", "Totals round half down.");
  assert.equal(concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001").verification, "verified");
});

test("approval and review state are not verification", () => {
  const root = project();
  write(path.join(sdd(root), "memory-bank", "core", "review-gate.md"), "# Review Gate\n\n## Findings\n\n| Date | Scope | Source | Severity | Status | Owner | Note |\n|---|---|---|---|---|---|---|\n");
  assert.equal(concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001").verification, "unverified");
});

test("metrics are small, deterministic and honest about gaps", () => {
  const root = project();
  recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" });
  const metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.deepEqual(metrics, {
    activeRules: 2,
    rulesWithRequirementLink: 1,
    requirements: 3,
    requirementsWithGoverningRule: 1,
    requirementsWithModule: 1,
    requirementsWithTestTarget: 1,
    rulesWithCompletePath: 1,
    brokenEdges: 0,
    verification: { verified: 1, failed: 0, stale: 0, unverified: 1 },
    staleEvidence: 0
  });
});

test("repeated builds and recordings are byte-identical, with no timestamps", () => {
  const root = project();
  const first = JSON.stringify(buildTraceability(root));
  assert.equal(JSON.stringify(buildTraceability(root)), first);
  const file = () => fs.readFileSync(recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" }).file, "utf8");
  const one = file();
  assert.equal(file(), one);
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(one), false);
});

test("a corrupt evidence file or knowledge map never breaks tracing; recording replaces it atomically", () => {
  const root = project();
  recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" });
  const evidenceDir = path.join(root, ".spectra", "cache", "verification");
  fs.writeFileSync(path.join(evidenceDir, "evidence.json"), "{ not json");
  assert.equal(readVerificationEvidence(root).status, "corrupt");
  assert.equal(concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001").verification, "unverified");
  fs.writeFileSync(path.join(root, ".spectra", "cache", "knowledge", "knowledge-map.json"), "{ not json");
  assert.equal(traceSubject(buildTraceability(root), "RULE-LOY-001").requirements.length, 1);
  recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" });
  assert.equal(readVerificationEvidence(root).status, "ok");
  assert.deepEqual(fs.readdirSync(evidenceDir).filter((name) => name !== "evidence.json"), [], "no temp files left behind");
});

test("a project without Governs or feature specs stays valid and reports an incomplete trace", () => {
  const root = project({ governs: null });
  fs.rmSync(path.join(sdd(root), "features"), { recursive: true });
  assert.deepEqual(validateBusinessContext(root), []);
  const metrics = traceabilityMetrics(buildTraceability(root), readVerificationEvidence(root));
  assert.equal(metrics.rulesWithRequirementLink, 0);
  assert.equal(metrics.requirements, 0);
  assert.equal(metrics.rulesWithCompletePath, 0);
});

test("tracing and recording never modify canonical files", () => {
  const root = project();
  const files = [rulesFile(root, "loyalty"), specFile(root), path.join(sdd(root), "memory-bank", "tech", "modules.md")];
  const before = files.map(hash);
  recordVerificationEvidence(root, { testTarget: "node:test-target:packages/loyalty", result: "passed", command: "node --test" });
  concludeVerification(buildTraceability(root), readVerificationEvidence(root), "RULE-LOY-001");
  assert.deepEqual(files.map(hash), before);
});

test("the Governs line is metadata: it does not change the rule's lookup terms, and the map contract rebuilds old caches", () => {
  const withLink = loadKnowledgeMap(project()).map.references.find((reference) => reference.id === "RULE-LOY-001");
  const without = loadKnowledgeMap(project({ governs: null })).map.references.find((reference) => reference.id === "RULE-LOY-001");
  assert.deepEqual(withLink.terms, without.terms);
  assert.deepEqual(withLink.relationships.governs, ["alpha#FR-1"]);
  const root = project();
  const mapPath = path.join(root, ".spectra", "cache", "knowledge", "knowledge-map.json");
  loadKnowledgeMap(root);
  const old = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  fs.writeFileSync(mapPath, JSON.stringify({ ...old, contractVersion: old.contractVersion - 1 }));
  assert.equal(loadKnowledgeMap(root).status, "rebuilt-stale");
});

test("dogfood: RULE-SPE-006 traces to spectra-core#FR-2 and packages-cli, and is honestly unverified without evidence", () => {
  assert.equal(run(repoRoot, ["index"]).status, 0);
  const trace = buildTraceability(repoRoot);
  const rule = traceSubject(trace, "RULE-SPE-006");
  assert.ok(rule.requirements.includes("spectra-core#FR-2"));
  assert.ok(edgesOf(trace, "governs").some((edge) => edge.from === "RULE-SPE-006" && edge.to === "spectra-core#AC-2"));
  assert.ok(rule.modules.some((module) => module.id === "node:module:packages/cli"));
  assert.ok(rule.testTargets.some((target) => target.id === "node:test-target:packages/cli"));
  const conclusion = concludeVerification(trace, { status: "missing", records: [] }, "RULE-SPE-006");
  assert.equal(conclusion.traceability.complete, true);
  assert.equal(conclusion.verification, "unverified");
  assert.deepEqual(validateBusinessContext(repoRoot), []);
});
