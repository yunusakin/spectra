// Phase 1A.3 — derived Knowledge Map.
//
// Failure modes enumerated BEFORE implementation:
//
// Determinism
//  - output depends on enumeration order (fs readdir, index row order) or clock
//  - object key order in YAML changes a signature
// Enumeration
//  - a rule/feature object is missed, or a malformed heading becomes an entry
//  - map entry disagrees with the Phase 1A.2 single-object resolver
//  - map embeds canonical text (becomes a second knowledge store)
//  - a directory rename / file move changes semantic id or object signature
// Identity
//  - duplicate RULE id, duplicate feature metadata.id, duplicate qualified
//    object id (including across FR/NFR/AC) silently overwrite each other
// Repo Index
//  - a second technical id is invented; evidence/record bodies are copied
//  - candidate/confirmed or confidence are normalized away
//  - index rebuilt with different records leaves the map "fresh"
// Freshness
//  - mtime-only touch reports stale; content edit reports fresh
//  - a moved rule keeps a stale locator but reports fresh
//  - missing map crashes instead of reporting "missing"
// Lifecycle
//  - building/writing/deleting the map touches canonical files, install.json,
//    approvals, recovery markers, git-visible state or `spectra context` output
//  - duplicate identities pass canonical `spectra check`

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  buildKnowledgeMap,
  checkKnowledgeMapFreshness,
  getKnowledgeMapPath,
  lookupKnowledgeReference,
  readKnowledgeMap,
  writeKnowledgeMap
} from "../src/lib/knowledge/map.js";
import { resolveBusinessRule, resolveFeatureObject } from "../src/lib/knowledge/address.js";
import { readIndex } from "../src/lib/index/cache.js";

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-knowledge-map-"));
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

function writeFeature(root, dirName, spec) {
  const dir = path.join(sdd(root), "features", dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "feature.spec.yaml"), typeof spec === "string" ? spec : YAML.stringify(spec));
  return path.join(dir, "feature.spec.yaml");
}

const featureSpec = (id, extra = {}) => ({
  metadata: { id },
  requirements: {
    functional: [{ id: "FR-1", statement: `${id} one` }, { id: "FR-2", statement: `${id} two` }],
    nonFunctional: [{ id: "NFR-1", statement: `${id} quality` }]
  },
  acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "g", when: "w", then: "t" }] },
  ...extra
});

function snapshot(dir, skip = () => false) {
  const files = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (skip(full)) continue;
      if (entry.isDirectory()) walk(full);
      else files[path.relative(dir, full)] = fs.readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return files;
}
const canonicalSnapshot = (root) => snapshot(path.join(root, ".spectra"), (full) => full.includes(`${path.sep}cache`));

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
  "## RULE-LOY-002 — Rounding",
  "",
  "Totals round half up.",
  "",
  "Status: active",
  ""
].join("\n");
const UNRESOLVED = "# Unresolved\n\n## RULE-LOY-003 — Pending\n\nNeeds a decision.\n\nStatus: unresolved\n";

function projectWithKnowledge() {
  const root = createProject();
  addDomain(root, "loyalty", RULES, UNRESOLVED);
  writeFeature(root, "alpha", featureSpec("alpha"));
  return root;
}

const ids = (map) => map.references.map((reference) => reference.id);
const bySig = (map, id) => lookupKnowledgeReference(map, id).signature;
const withoutSignature = ({ signature, ...reference }) => reference;

// ---- Determinism -----------------------------------------------------------------

test("same canonical state builds a byte-identical, id-sorted map", () => {
  const root = projectWithKnowledge();
  const first = buildKnowledgeMap(root);
  const second = buildKnowledgeMap(root);
  assert.deepEqual(first, second);
  assert.deepEqual(ids(first), [...ids(first)].sort());
  writeKnowledgeMap(root, first);
  const bytes = fs.readFileSync(getKnowledgeMapPath(root), "utf8");
  writeKnowledgeMap(root, buildKnowledgeMap(root));
  assert.equal(fs.readFileSync(getKnowledgeMapPath(root), "utf8"), bytes);
  assert.deepEqual(readKnowledgeMap(root), JSON.parse(bytes));
  assert.equal("generatedAt" in first, false);
  assert.match(first.sourceSignature, /^[0-9a-f]{64}$/);
});

// ---- Business rules --------------------------------------------------------------

test("every valid rule is enumerated, malformed headings are not, and entries match the resolver", () => {
  const root = projectWithKnowledge();
  fs.appendFileSync(path.join(businessRoot(root), "loyalty", "rules.md"), "\n## RULE-LOY-004 - wrong dash\n\nBody\n\nStatus: active\n");
  const map = buildKnowledgeMap(root);
  const ruleIds = map.references.filter((reference) => reference.kind === "business-rule").map((reference) => reference.id);
  assert.deepEqual(ruleIds, ["RULE-LOY-001", "RULE-LOY-002", "RULE-LOY-003"]);
  for (const id of ruleIds) {
    assert.deepEqual(withoutSignature(lookupKnowledgeReference(map, id)), resolveBusinessRule(root, id).reference);
  }
});

test("the map is a locator index: it never embeds canonical text", () => {
  const root = projectWithKnowledge();
  const serialized = JSON.stringify(buildKnowledgeMap(root));
  for (const text of ["Expired points cannot pay", "Totals round half up", "Needs a decision", "alpha one"]) {
    assert.equal(serialized.includes(text), false, text);
  }
});

test("moving a rule updates the locator and map signature but keeps id and object signature", () => {
  const root = projectWithKnowledge();
  const before = buildKnowledgeMap(root);
  const rules = fs.readFileSync(path.join(businessRoot(root), "loyalty", "rules.md"), "utf8");
  const section = rules.slice(rules.indexOf("## RULE-LOY-002"));
  fs.writeFileSync(path.join(businessRoot(root), "loyalty", "rules.md"), rules.replace(section, ""));
  addDomain(root, "rewards", `# Rules\n\n${section}`);
  const after = buildKnowledgeMap(root);
  const was = lookupKnowledgeReference(before, "RULE-LOY-002");
  const now = lookupKnowledgeReference(after, "RULE-LOY-002");
  assert.equal(now.source, "sdd/memory-bank/business/rewards/rules.md");
  assert.notEqual(now.source, was.source);
  assert.equal(now.signature, was.signature);
  assert.notEqual(after.sourceSignature, before.sourceSignature, "stale locator must not look fresh");
});

test("duplicate rule IDs fail map generation deterministically", () => {
  const root = projectWithKnowledge();
  addDomain(root, "rewards", "# Rules\n\n## RULE-LOY-001 — Copy\n\nCopy.\n\nStatus: active\n");
  assert.throws(() => buildKnowledgeMap(root), /Duplicate business rule ID: RULE-LOY-001/);
  assert.throws(() => buildKnowledgeMap(root), /Duplicate business rule ID: RULE-LOY-001/);
});

// ---- Feature objects -------------------------------------------------------------

test("FR, NFR and AC are enumerated with qualified ids and match the resolver", () => {
  const root = projectWithKnowledge();
  const map = buildKnowledgeMap(root);
  const featureIds = ids(map).filter((id) => id.startsWith("alpha#"));
  assert.deepEqual(featureIds, ["alpha#AC-1", "alpha#FR-1", "alpha#FR-2", "alpha#NFR-1"]);
  for (const id of featureIds) {
    assert.deepEqual(withoutSignature(lookupKnowledgeReference(map, id)), resolveFeatureObject(root, id).reference);
  }
  assert.deepEqual(lookupKnowledgeReference(map, "alpha#AC-1").relationships, { covers: ["FR-1"] });
  assert.equal(lookupKnowledgeReference(map, "alpha#FR-1").kind, "functional-requirement");
});

test("renaming the feature directory keeps ids and signatures; local ids stay canonical", () => {
  const root = projectWithKnowledge();
  const before = buildKnowledgeMap(root);
  const features = path.join(sdd(root), "features");
  fs.renameSync(path.join(features, "alpha"), path.join(features, "renamed"));
  const after = buildKnowledgeMap(root);
  assert.equal(bySig(after, "alpha#FR-1"), bySig(before, "alpha#FR-1"));
  assert.equal(lookupKnowledgeReference(after, "alpha#FR-1").source, "sdd/features/renamed/feature.spec.yaml");
  const spec = YAML.parse(fs.readFileSync(path.join(features, "renamed", "feature.spec.yaml"), "utf8"));
  assert.equal(spec.requirements.functional[0].id, "FR-1");
});

test("duplicate feature ids and duplicate object ids (even across families) fail", () => {
  const root = projectWithKnowledge();
  writeFeature(root, "alpha-copy", featureSpec("alpha"));
  assert.throws(() => buildKnowledgeMap(root), /Duplicate feature ID: alpha/);
  const root2 = createProject();
  writeFeature(root2, "beta", featureSpec("beta", { acceptance: { scenarios: [{ id: "FR-1" }] } }));
  assert.throws(() => buildKnowledgeMap(root2), /Duplicate feature object ID: beta#FR-1/);
  const root3 = createProject();
  writeFeature(root3, "gamma", featureSpec("gamma", { acceptance: { scenarios: [{ id: "AC-1" }, { id: "AC-1" }] } }));
  assert.throws(() => buildKnowledgeMap(root3), /Duplicate feature object ID: gamma#AC-1/);
});

test("real Spectra feature objects appear in the map", () => {
  const map = buildKnowledgeMap(repoRoot);
  for (const id of ["spectra-core#FR-2", "spectra-core#AC-2", "spectra-core#NFR-1"]) {
    assert.deepEqual(withoutSignature(lookupKnowledgeReference(map, id)), resolveFeatureObject(repoRoot, id).reference);
  }
});

// ---- Signatures ------------------------------------------------------------------

test("a content edit changes only that object's signature and the map signature", () => {
  const root = projectWithKnowledge();
  const before = buildKnowledgeMap(root);
  const file = path.join(businessRoot(root), "loyalty", "rules.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Totals round half up.", "Totals round half even."));
  const after = buildKnowledgeMap(root);
  assert.notEqual(bySig(after, "RULE-LOY-002"), bySig(before, "RULE-LOY-002"));
  assert.equal(bySig(after, "RULE-LOY-001"), bySig(before, "RULE-LOY-001"));
  assert.equal(bySig(after, "alpha#FR-1"), bySig(before, "alpha#FR-1"));
  assert.notEqual(after.sourceSignature, before.sourceSignature);
});

test("feature object signatures follow content, not YAML key order or siblings", () => {
  const root = projectWithKnowledge();
  const before = buildKnowledgeMap(root);
  const spec = featureSpec("alpha");
  spec.requirements.functional[0] = { statement: "alpha one", id: "FR-1" };
  spec.requirements.functional[1].statement = "alpha two CHANGED";
  writeFeature(root, "alpha", spec);
  const after = buildKnowledgeMap(root);
  assert.equal(bySig(after, "alpha#FR-1"), bySig(before, "alpha#FR-1"));
  assert.notEqual(bySig(after, "alpha#FR-2"), bySig(before, "alpha#FR-2"));
});

// ---- Repo Index ------------------------------------------------------------------

test("Repo Index records are referenced with their own ids and source-native metadata", () => {
  const root = projectWithKnowledge();
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }));
  assert.equal(run(root, ["index"]).status, 0);
  const index = readIndex(root);
  const map = buildKnowledgeMap(root);
  const repoRefs = map.references.filter((reference) => reference.source === "repo-index");
  assert.deepEqual(repoRefs.map((reference) => reference.id).sort(), index.records.map((record) => record.id).sort());
  for (const record of index.records) {
    const reference = lookupKnowledgeReference(map, record.id);
    assert.equal(reference.kind, record.kind);
    assert.equal(reference.provenance, "repository-discovered");
    assert.equal(reference.status, record.status);
    assert.equal(reference.confidence, record.confidence);
    assert.equal(reference.address, record.id);
    assert.equal("evidence" in reference, false);
    assert.equal("attributes" in reference, false);
  }
  assert.equal(map.references.filter((reference) => reference.provenance === "repository-discovered").length, index.records.length);
  assert.equal(map.references.filter((reference) => reference.provenance === "human-declared").length, map.references.length - index.records.length);
});

test("a rebuilt Repo Index makes the map stale", () => {
  const root = projectWithKnowledge();
  writeKnowledgeMap(root, buildKnowledgeMap(root));
  assert.equal(checkKnowledgeMapFreshness(root).status, "fresh");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }));
  assert.equal(run(root, ["index"]).status, 0);
  assert.equal(checkKnowledgeMapFreshness(root).status, "stale");
});

// ---- Freshness -------------------------------------------------------------------

test("missing -> fresh -> stale -> fresh, and mtime alone never makes it stale", () => {
  const root = projectWithKnowledge();
  assert.equal(checkKnowledgeMapFreshness(root).status, "missing");
  writeKnowledgeMap(root, buildKnowledgeMap(root));
  assert.equal(checkKnowledgeMapFreshness(root).status, "fresh");

  const file = path.join(businessRoot(root), "loyalty", "rules.md");
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(file, future, future);
  assert.equal(checkKnowledgeMapFreshness(root).status, "fresh");

  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Totals round half up.", "Totals truncate."));
  assert.equal(checkKnowledgeMapFreshness(root).status, "stale");
  writeKnowledgeMap(root, buildKnowledgeMap(root));
  assert.equal(checkKnowledgeMapFreshness(root).status, "fresh");
});

test("a stale-contract or corrupt map is reported stale, deletion is reported missing", () => {
  const root = projectWithKnowledge();
  writeKnowledgeMap(root, buildKnowledgeMap(root));
  const mapPath = getKnowledgeMapPath(root);
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  fs.writeFileSync(mapPath, JSON.stringify({ ...map, contractVersion: 0 }));
  assert.equal(checkKnowledgeMapFreshness(root).status, "stale");
  fs.writeFileSync(mapPath, "{not json");
  assert.equal(checkKnowledgeMapFreshness(root).status, "stale");
  fs.rmSync(path.dirname(mapPath), { recursive: true });
  assert.equal(checkKnowledgeMapFreshness(root).status, "missing");
});

// ---- Validation ------------------------------------------------------------------

test("canonical check rejects duplicate object ids inside a feature spec", () => {
  const root = createProject();
  const spec = YAML.parse(fs.readFileSync(path.join(sdd(root), "features", "spectra-core", "feature.spec.yaml"), "utf8"));
  const first = spec.requirements.functional[0];
  spec.requirements.functional.push({ ...first });
  fs.writeFileSync(path.join(sdd(root), "features", "spectra-core", "feature.spec.yaml"), YAML.stringify(spec));
  const result = run(root, ["check"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`Duplicate feature object ID: ${spec.metadata.id}#${first.id}`));
});

test("canonical check rejects the same metadata.id in two feature directories", () => {
  const root = createProject();
  const spec = YAML.parse(fs.readFileSync(path.join(sdd(root), "features", "spectra-core", "feature.spec.yaml"), "utf8"));
  fs.cpSync(path.join(sdd(root), "features", "spectra-core"), path.join(sdd(root), "features", "copy"), { recursive: true });
  const result = run(root, ["check"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`Duplicate feature ID: ${spec.metadata.id}`));
});

// ---- Lifecycle / approval / context regression ------------------------------------

test("build, write and delete never touch canonical state, approvals, git or `spectra context`", () => {
  const root = projectWithKnowledge();
  const contextArgs = ["context", "--role", "implementer", "--goal", "implement", "--format", "json"];
  const contextBefore = run(root, contextArgs);
  assert.equal(contextBefore.status, 0, contextBefore.stderr);
  const checkBefore = run(root, ["check"]);
  const canonical = canonicalSnapshot(root);
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout;

  writeKnowledgeMap(root, buildKnowledgeMap(root));
  const mapPath = getKnowledgeMapPath(root);
  assert.equal(fs.existsSync(mapPath), true);
  assert.equal(path.relative(root, mapPath).split(path.sep).slice(0, 2).join("/"), ".spectra/cache");
  assert.equal(spawnSync("git", ["check-ignore", "-q", path.relative(root, mapPath)], { cwd: root }).status, 0);
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout, status);
  assert.deepEqual(canonicalSnapshot(root), canonical);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "recovery")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "migration.json")), false);
  assert.equal(run(root, contextArgs).stdout, contextBefore.stdout);
  const checkAfter = run(root, ["check"]);
  assert.equal(checkAfter.status, checkBefore.status);
  assert.equal(checkAfter.stderr, checkBefore.stderr);

  fs.rmSync(path.dirname(mapPath), { recursive: true });
  assert.deepEqual(canonicalSnapshot(root), canonical);
  assert.equal(run(root, contextArgs).stdout, contextBefore.stdout);
});
