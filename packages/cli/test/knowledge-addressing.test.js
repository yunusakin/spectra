// Phase 1A.2 — knowledge addressability.
//
// Failure modes enumerated BEFORE implementation (AGENTS.md: isolated systems
// list how they can fail first):
//
// Business-rule sections
//  - id absent; id only present in a malformed heading
//  - id is a prefix of another id (RULE-X-001 vs RULE-X-0010), in either order
//  - same id in two files (rules.md + unresolved.md, or two domains)
//  - same id twice inside one file
//  - section is last in file / followed by ### subheadings / reordered / moved
//  - business index row points outside business memory (path traversal)
//  - resolution must not mutate any file
// Feature objects
//  - unqualified id (ambiguous across features); empty feature or local part
//  - unknown feature; unknown local id; wrong object family
//  - same local id in two features (must stay distinct)
//  - duplicate local id inside one feature; duplicate feature ids
//  - feature spec without metadata.id is not addressable
//  - invalid YAML surfaces the existing "Invalid YAML" error
//  - resolution must not rewrite canonical IDs/files
// Lifecycle
//  - promote/transition of RULE-X-001 must never touch RULE-X-0010

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { parseRuleSections, findRuleSection } from "../src/lib/business/rule-sections.js";
import { resolveBusinessRule, resolveFeatureObject } from "../src/lib/knowledge/address.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..");
const repoRoot = path.resolve(cliRoot, "..", "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") }
  });
}

function createProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-knowledge-addressing-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  return root;
}

const sdd = (root) => path.join(root, ".spectra", "sdd");
const businessRoot = (root) => path.join(sdd(root), "memory-bank", "business");

function addDomain(root, domain, rules, unresolved = "# Unresolved\n") {
  const dir = path.join(businessRoot(root), domain);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(businessRoot(root), "INDEX.md"), `| ${domain} | | business/${domain}/rules.md | business/${domain}/unresolved.md | |\n`);
  fs.writeFileSync(path.join(dir, "rules.md"), rules);
  fs.writeFileSync(path.join(dir, "unresolved.md"), unresolved);
  return dir;
}

function snapshot(dir) {
  const files = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[path.relative(dir, full)] = fs.readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return files;
}

const RULES = [
  "# Rules",
  "",
  "## RULE-LOY-001 — Expiration",
  "",
  "Expired points cannot pay.",
  "",
  "Status: active",
  "Affected Modules: loyalty-api, billing",
  "",
  "### Notes",
  "",
  "Sub-heading belongs to the rule.",
  "",
  "## RULE-LOY-0010 — Tenth",
  "",
  "Tenth rule text.",
  "",
  "Status: active",
  ""
].join("\n");

// ---- Markdown rule sections -------------------------------------------------

test("rule parser returns the exact section and keeps sub-headings inside it", () => {
  const section = findRuleSection(RULES, "RULE-LOY-001");
  assert.equal(section.id, "RULE-LOY-001");
  assert.equal(section.title, "Expiration");
  assert.match(section.raw, /Sub-heading belongs to the rule\./);
  assert.doesNotMatch(section.raw, /Tenth/);
  assert.equal(RULES.slice(section.start, section.end), section.raw);
});

test("RULE-X-001 never matches RULE-X-0010, in either order", () => {
  const reversed = "## RULE-LOY-0010 — Tenth\n\nTen.\n\nStatus: active\n\n## RULE-LOY-001 — One\n\nOne.\n\nStatus: active\n";
  assert.match(findRuleSection(reversed, "RULE-LOY-001").raw, /One\./);
  assert.match(findRuleSection(reversed, "RULE-LOY-0010").raw, /Ten\./);
  assert.equal(findRuleSection("## RULE-LOY-0010 — Tenth\n\nTen.\n", "RULE-LOY-001"), null);
});

test("malformed headings are reported, never resolved", () => {
  const content = "## RULE-LOY-001 - hyphen not em dash\n\nBody\n\nStatus: active\n\n## RULE-LOY-002 — Fine\n\nBody\n";
  const sections = parseRuleSections(content);
  assert.equal(sections[0].id, null);
  assert.equal(sections[0].heading, "RULE-LOY-001 - hyphen not em dash");
  assert.equal(findRuleSection(content, "RULE-LOY-001"), null);
  assert.equal(findRuleSection(content, "RULE-LOY-002").title, "Fine");
});

// ---- resolveBusinessRule ----------------------------------------------------

test("resolves an exact rule and excludes unrelated sections", () => {
  const root = createProject();
  addDomain(root, "loyalty", RULES);
  const { reference, text } = resolveBusinessRule(root, "RULE-LOY-001");
  assert.match(text, /Expired points cannot pay\./);
  assert.doesNotMatch(text, /Tenth/);
  assert.deepEqual(reference, {
    id: "RULE-LOY-001",
    kind: "business-rule",
    source: "sdd/memory-bank/business/loyalty/rules.md",
    address: "section:RULE-LOY-001",
    provenance: "human-declared",
    status: "active",
    relationships: { affectedModules: ["loyalty-api", "billing"] }
  });
  assert.equal(resolveBusinessRule(root, "RULE-LOY-0010").reference.status, "active");
});

test("identity survives section reorder and unrelated insertions", () => {
  const root = createProject();
  const dir = addDomain(root, "loyalty", RULES);
  const before = resolveBusinessRule(root, "RULE-LOY-001").reference;
  const [head, first, second] = RULES.split(/(?=^## )/m);
  fs.writeFileSync(path.join(dir, "rules.md"), `${head}## RULE-LOY-002 — Inserted\n\nNew.\n\nStatus: active\n\n${second}${first}`);
  assert.deepEqual(resolveBusinessRule(root, "RULE-LOY-001").reference, before);
});

test("identity survives moving the rule to another domain after the index is updated", () => {
  const root = createProject();
  addDomain(root, "loyalty", RULES);
  const before = resolveBusinessRule(root, "RULE-LOY-001").reference;
  const section = findRuleSection(RULES, "RULE-LOY-001");
  fs.writeFileSync(path.join(businessRoot(root), "loyalty", "rules.md"), RULES.replace(section.raw, ""));
  addDomain(root, "rewards", `# Rules\n\n${section.raw}\n`);
  const after = resolveBusinessRule(root, "RULE-LOY-001").reference;
  assert.equal(after.id, before.id);
  assert.equal(after.address, before.address);
  assert.equal(after.source, "sdd/memory-bank/business/rewards/rules.md");
});

test("resolves a rule living in unresolved.md and keeps its native status", () => {
  const root = createProject();
  addDomain(root, "loyalty", "# Rules\n", "# Unresolved\n\n## RULE-LOY-003 — Pending\n\nNeeds a decision.\n\nStatus: unresolved\n");
  const { reference } = resolveBusinessRule(root, "RULE-LOY-003");
  assert.equal(reference.status, "unresolved");
  assert.equal(reference.source, "sdd/memory-bank/business/loyalty/unresolved.md");
  assert.deepEqual(reference.relationships, {});
});

test("missing rule fails clearly", () => {
  const root = createProject();
  addDomain(root, "loyalty", RULES);
  assert.throws(() => resolveBusinessRule(root, "RULE-LOY-999"), /Business rule not found: RULE-LOY-999/);
  assert.throws(() => resolveBusinessRule(root, "RULE-LOY-00"), /Business rule not found/);
});

test("duplicate rule IDs across files are rejected", () => {
  const root = createProject();
  addDomain(root, "loyalty", "# Rules\n\n## RULE-LOY-001 — One\n\nOne.\n\nStatus: active\n", "# U\n\n## RULE-LOY-001 — Two\n\nTwo.\n\nStatus: unresolved\n");
  assert.throws(() => resolveBusinessRule(root, "RULE-LOY-001"), /Duplicate business rule ID: RULE-LOY-001/);
});

test("duplicate rule IDs inside one file are rejected", () => {
  const root = createProject();
  addDomain(root, "loyalty", "# Rules\n\n## RULE-LOY-001 — One\n\nOne.\n\nStatus: active\n\n## RULE-LOY-001 — Again\n\nTwo.\n\nStatus: active\n");
  assert.throws(() => resolveBusinessRule(root, "RULE-LOY-001"), /Duplicate business rule ID/);
});

test("an index path outside business memory is rejected", () => {
  const root = createProject();
  fs.appendFileSync(path.join(businessRoot(root), "INDEX.md"), "| evil | | business/../../outside.md | business/evil/unresolved.md | |\n");
  assert.throws(() => resolveBusinessRule(root, "RULE-LOY-001"), /outside business memory/);
});

test("rule resolution is read-only and leaves check passing", () => {
  const root = createProject();
  addDomain(root, "loyalty", RULES);
  const before = snapshot(path.join(root, ".spectra"));
  resolveBusinessRule(root, "RULE-LOY-001");
  assert.deepEqual(snapshot(path.join(root, ".spectra")), before);
});

// ---- Feature objects ----------------------------------------------------------

test("resolves FR, NFR and AC from the real Spectra feature spec by qualified ID", () => {
  const spec = YAML.parse(fs.readFileSync(path.join(repoRoot, "sdd", "features", "spectra-core", "feature.spec.yaml"), "utf8"));
  const fr = resolveFeatureObject(repoRoot, "spectra-core#FR-2");
  assert.equal(fr.reference.id, "spectra-core#FR-2");
  assert.equal(fr.reference.kind, "functional-requirement");
  assert.equal(fr.reference.source, "sdd/features/spectra-core/feature.spec.yaml");
  assert.equal(fr.reference.address, "yaml:requirements.functional[id=FR-2]");
  assert.equal(fr.reference.provenance, "human-declared");
  assert.deepEqual(fr.object, spec.requirements.functional.find((item) => item.id === "FR-2"));
  assert.notEqual(fr.object.id, "spectra-core#FR-2", "canonical id is not rewritten");

  const nfr = resolveFeatureObject(repoRoot, "spectra-core#NFR-1");
  assert.equal(nfr.reference.kind, "non-functional-requirement");
  assert.equal(nfr.reference.address, "yaml:requirements.nonFunctional[id=NFR-1]");

  const ac = resolveFeatureObject(repoRoot, "spectra-core#AC-2");
  assert.equal(ac.reference.kind, "acceptance-scenario");
  assert.equal(ac.reference.address, "yaml:acceptance.scenarios[id=AC-2]");
  assert.deepEqual(ac.reference.relationships, { covers: ["FR-2"], verifiedBy: ["node:test-target:packages/cli:test:approval", "node:test-target:packages/cli:test:install-layout"] });
  assert.deepEqual(ac.object, spec.acceptance.scenarios.find((item) => item.id === "AC-2"));

  const invariant = resolveFeatureObject(repoRoot, "spectra-core#INV-1");
  assert.equal(invariant.reference.kind, "architectural-invariant");
  assert.equal(invariant.reference.address, "yaml:invariants[id=INV-1]");
  assert.deepEqual(invariant.reference.relationships, { verifiedBy: ["node:test-target:packages/cli:test:knowledge"] });

  const lifecycle = resolveFeatureObject(repoRoot, "spectra-lifecycle#FR-1");
  assert.equal(lifecycle.reference.source, "sdd/features/spectra-lifecycle/feature.spec.yaml");
  assert.equal(lifecycle.reference.kind, "functional-requirement");
});

function writeFeature(root, dirName, spec) {
  const dir = path.join(sdd(root), "features", dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "feature.spec.yaml"), typeof spec === "string" ? spec : YAML.stringify(spec));
  return path.join(dir, "feature.spec.yaml");
}

const featureSpec = (id, extra = {}) => ({
  metadata: { id },
  requirements: { functional: [{ id: "FR-1", statement: `${id} one` }, { id: "FR-2", statement: `${id} two` }], nonFunctional: [] },
  acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "g", when: "w", then: "t" }] },
  ...extra
});

test("same local ID in two features stays distinct and canonical files are untouched", () => {
  const root = createProject();
  const a = writeFeature(root, "alpha", featureSpec("alpha"));
  const b = writeFeature(root, "beta", featureSpec("beta"));
  const bytes = [fs.readFileSync(a, "utf8"), fs.readFileSync(b, "utf8")];
  assert.equal(resolveFeatureObject(root, "alpha#FR-1").object.statement, "alpha one");
  assert.equal(resolveFeatureObject(root, "beta#FR-1").object.statement, "beta one");
  assert.deepEqual([fs.readFileSync(a, "utf8"), fs.readFileSync(b, "utf8")], bytes);
});

test("feature identity comes from metadata.id, not the directory name", () => {
  const root = createProject();
  writeFeature(root, "renamed-dir", featureSpec("alpha"));
  assert.equal(resolveFeatureObject(root, "alpha#FR-2").reference.source, "sdd/features/renamed-dir/feature.spec.yaml");
  assert.throws(() => resolveFeatureObject(root, "renamed-dir#FR-2"), /Feature not found: renamed-dir/);
});

test("unqualified, malformed, unknown and missing feature IDs fail clearly", () => {
  const root = createProject();
  writeFeature(root, "alpha", featureSpec("alpha"));
  assert.throws(() => resolveFeatureObject(root, "FR-1"), /must be qualified as <feature-id>#<object-id>/);
  assert.throws(() => resolveFeatureObject(root, "#FR-1"), /must be qualified/);
  assert.throws(() => resolveFeatureObject(root, "alpha#"), /must be qualified/);
  assert.throws(() => resolveFeatureObject(root, "nope#FR-1"), /Feature not found: nope/);
  assert.throws(() => resolveFeatureObject(root, "alpha#FR-9"), /Feature object not found: alpha#FR-9/);
  assert.throws(() => resolveFeatureObject(root, "alpha#FR"), /Feature object not found/);
});

test("duplicate local IDs inside one feature and duplicate feature IDs are rejected", () => {
  const root = createProject();
  writeFeature(root, "alpha", featureSpec("alpha", {
    acceptance: { scenarios: [{ id: "AC-1" }, { id: "AC-1" }] }
  }));
  assert.throws(() => resolveFeatureObject(root, "alpha#AC-1"), /Duplicate feature object ID: alpha#AC-1/);
  writeFeature(root, "alpha-copy", featureSpec("alpha"));
  assert.throws(() => resolveFeatureObject(root, "alpha#FR-1"), /Duplicate feature ID: alpha/);
});

test("a spec without metadata.id is not addressable and invalid YAML keeps the existing error", () => {
  const root = createProject();
  writeFeature(root, "anonymous", { requirements: { functional: [{ id: "FR-1" }] } });
  assert.throws(() => resolveFeatureObject(root, "anonymous#FR-1"), /Feature not found/);
  const root2 = createProject();
  writeFeature(root2, "broken", "metadata: [unterminated\n");
  assert.throws(() => resolveFeatureObject(root2, "broken#FR-1"), /Invalid YAML/);
});

// ---- Lifecycle regression through the CLI -----------------------------------

test("knowledge promote of RULE-LOY-001 never touches RULE-LOY-0010", () => {
  const root = createProject();
  addDomain(
    root,
    "loyalty",
    "# Rules\n",
    "# Unresolved\n\n## RULE-LOY-0010 — Tenth\n\nTenth.\n\nStatus: unresolved\n\n## RULE-LOY-001 — One\n\nOne.\n\nStatus: unresolved\n"
  );
  const result = run(root, ["knowledge", "promote", "--id", "RULE-LOY-001"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const rules = fs.readFileSync(path.join(businessRoot(root), "loyalty", "rules.md"), "utf8");
  const unresolved = fs.readFileSync(path.join(businessRoot(root), "loyalty", "unresolved.md"), "utf8");
  assert.match(rules, /RULE-LOY-001 — One/);
  assert.doesNotMatch(rules, /RULE-LOY-0010/);
  assert.match(unresolved, /RULE-LOY-0010 — Tenth/);
  assert.doesNotMatch(unresolved, /RULE-LOY-001 — One/);
  assert.equal(run(root, ["check"]).status, 0);
});

test("knowledge supersede of RULE-LOY-001 never touches RULE-LOY-0010", () => {
  const root = createProject();
  addDomain(root, "loyalty", "# Rules\n\n## RULE-LOY-0010 — Tenth\n\nTenth.\n\nStatus: active\n\n## RULE-LOY-001 — One\n\nOne.\n\nStatus: active\n");
  const result = run(root, ["knowledge", "supersede", "--id", "RULE-LOY-001"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(
    [resolveBusinessRule(root, "RULE-LOY-0010").reference.status, resolveBusinessRule(root, "RULE-LOY-001").reference.status],
    ["active", "superseded"]
  );
});

// ---- Lifecycle / approval / schema regression ------------------------------------

test("addressing never changes project schema, markers, approvals or machine state", () => {
  const root = createProject();
  addDomain(root, "loyalty", RULES);
  const installJson = path.join(root, ".spectra", "install.json");
  const before = { tree: snapshot(path.join(root, ".spectra")), install: fs.readFileSync(installJson, "utf8") };
  resolveBusinessRule(root, "RULE-LOY-001");
  resolveFeatureObject(root, "spectra-core#FR-1");
  assert.deepEqual(snapshot(path.join(root, ".spectra")), before.tree);
  assert.equal(fs.readFileSync(installJson, "utf8"), before.install);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "recovery")), false);
  const approvalState = fs.readFileSync(path.join(sdd(root), "governance", "approval-state.yaml"), "utf8");
  assert.equal(approvalState, before.tree[path.join("sdd", "governance", "approval-state.yaml")]);
  const check = run(root, ["check"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
});
