// Phase 1B.1 — context resolver integration (`spectra context --route-task`).
//
// Failure modes enumerated BEFORE implementation:
//
// Knowledge Map use
//  - stale map trusted after a rule/spec edit; missing/corrupt map crashes or
//    yields silently wrong context; map rebuilt on every call (never "fresh")
// Business routing
//  - whole rules.md/unresolved.md still inserted; unrelated domain rules leak;
//    rule-level overlap ignored; domain with no overlapping rule returns nothing
//  - unresolved status lost; RULE-X-001 explicit ref also pulls RULE-X-0010
// Feature objects
//  - sibling objects from the same spec pulled in; AC.covers not followed;
//    reverse (FR -> AC) expansion recursive or unbounded
// Repo Index
//  - whole index inserted; ids altered; module not reached via affectedModules;
//    test-target missing; unrelated module included
// Changed files
//  - unrelated module included; root "." module matches every file
// Determinism / dedupe
//  - order depends on discovery path; same id appears twice instead of merged reasons
// Rendering
//  - entry carries the whole source file instead of the exact object
// Regression
//  - plain `context` gains knowledge fields or touches the cache; canonical
//    files, install.json, approvals or recovery markers change

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

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

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function createProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-context-knowledge-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "spectra@example.test");
  git(root, "config", "user.name", "Spectra Test");
  assert.equal(run(root, ["init", "."]).status, 0);
  return root;
}

const sdd = (root) => path.join(root, ".spectra", "sdd");
const business = (root) => path.join(sdd(root), "memory-bank", "business");
const rulesFile = (root, domain) => path.join(business(root), domain, "rules.md");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function writeFeature(root, name, spec) {
  write(path.join(sdd(root), "features", name, "feature.spec.yaml"), YAML.stringify(spec));
}

const SPEC = {
  metadata: { id: "alpha" },
  requirements: {
    functional: [{ id: "FR-1", statement: "Customers redeem loyalty credits" }, { id: "FR-2", statement: "Warehouse ships parcels" }],
    nonFunctional: []
  },
  acceptance: {
    scenarios: [
      { id: "AC-1", covers: ["FR-1"], given: "a customer", when: "they redeem", then: "credits drop" },
      { id: "AC-2", covers: ["FR-2"], given: "a parcel", when: "it ships", then: "tracking appears" }
    ]
  }
};

// Workspace with loyalty + billing packages, two business domains and four rules.
function businessProject() {
  const root = createProject();
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty-api", scripts: { test: "node --test" } }));
  write(path.join(root, "packages", "billing", "package.json"), JSON.stringify({ name: "billing", scripts: { test: "node --test" } }));
  write(path.join(root, "packages", "loyalty", "src", "index.js"), "export const a = 1;\n");
  write(path.join(root, "packages", "billing", "src", "index.js"), "export const b = 1;\n");
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "",
    "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| loyalty-api | Loyalty | packages/loyalty/ | loyalty |",
    "| billing | Billing | packages/billing/ | payments |", ""
  ].join("\n"));
  write(path.join(business(root), "INDEX.md"), [
    "# Business Domain Index", "",
    "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| loyalty | points,rewards | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |",
    "| payments | refunds | business/payments/rules.md | business/payments/unresolved.md | billing |", ""
  ].join("\n"));
  write(rulesFile(root, "loyalty"), [
    "# Rules", "",
    "## RULE-LOY-001 — Expiration", "", "Expired points cannot pay for orders.", "", "Status: active", "Affected Modules: loyalty-api", "",
    "## RULE-LOY-002 — Rounding", "", "Totals round half up.", "", "Status: active", ""
  ].join("\n"));
  write(path.join(business(root), "loyalty", "unresolved.md"), "# U\n\n## RULE-LOY-003 — Grace\n\nGrace period needs a decision.\n\nStatus: unresolved\n");
  write(rulesFile(root, "payments"), "# Rules\n\n## RULE-PAY-001 — Settlement\n\nRefunds follow settlement.\n\nStatus: active\nAffected Modules: billing\n");
  write(path.join(business(root), "payments", "unresolved.md"), "# U\n");
  writeFeature(root, "alpha", SPEC);
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

function resolve(root, task, extra = []) {
  const result = run(root, ["context", "--route-task", task, "--format", "json", ...extra]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pack = JSON.parse(result.stdout);
  return { pack, resolved: pack.entries.filter((entry) => entry.source === "resolved") };
}
const idsOf = (resolved) => resolved.map((entry) => entry.knowledgeId);
const entryOf = (resolved, id) => resolved.find((entry) => entry.knowledgeId === id);
const reasonsOf = (resolved, id) => entryOf(resolved, id).reasons.map(({ reason }) => reason);

// ---- Knowledge Map integration ----------------------------------------------------

test("map lifecycle: missing -> rebuilt, then fresh, then stale after an edit, and corrupt is rebuilt", () => {
  const root = businessProject();
  const mapPath = path.join(root, ".spectra", "cache", "knowledge", "knowledge-map.json");
  assert.equal(resolve(root, "Fix expired points").pack.knowledge.map, "rebuilt-missing");
  assert.equal(fs.existsSync(mapPath), true);
  assert.equal(resolve(root, "Fix expired points").pack.knowledge.map, "fresh");

  const file = rulesFile(root, "loyalty");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Expired points cannot pay for orders.", "Expired points cannot pay for refunds."));
  const edited = resolve(root, "Fix expired points");
  assert.equal(edited.pack.knowledge.map, "rebuilt-stale");
  assert.match(entryOf(edited.resolved, "RULE-LOY-001").content, /cannot pay for refunds/);

  fs.writeFileSync(mapPath, "{corrupt");
  const healed = resolve(root, "Fix expired points");
  assert.equal(healed.pack.knowledge.map, "rebuilt-missing", "an unreadable map is treated as missing");
  assert.deepEqual(idsOf(healed.resolved), idsOf(edited.resolved));
  fs.rmSync(path.dirname(mapPath), { recursive: true });
  assert.equal(resolve(root, "Fix expired points").pack.knowledge.map, "rebuilt-missing");
});

// ---- Business routing -------------------------------------------------------------

test("a matched domain yields only the overlapping rule, its module and test-target; nothing from other domains", () => {
  const root = businessProject();
  const { pack, resolved } = resolve(root, "Fix expired points");
  assert.deepEqual(idsOf(resolved).sort(), ["RULE-LOY-001", "node:module:packages/loyalty", "node:test-target:packages/loyalty"]);
  assert.deepEqual(reasonsOf(resolved, "RULE-LOY-001"), ["business-rule-match"]);
  assert.deepEqual(entryOf(resolved, "RULE-LOY-001").reasons[0].via, "expir,point");
  assert.deepEqual(entryOf(resolved, "node:module:packages/loyalty").reasons, [{ reason: "repo-index-evidence", via: "RULE-LOY-001" }]);
  assert.deepEqual(reasonsOf(resolved, "node:test-target:packages/loyalty"), ["repo-index-evidence"]);
  const paths = pack.entries.filter((entry) => entry.source !== "resolved").map((entry) => entry.path);
  assert.equal(paths.includes("sdd/memory-bank/business/loyalty/rules.md"), false, "whole rule file replaced by exact rules");
  assert.equal(paths.includes("sdd/memory-bank/business/INDEX.md"), true, "domain index stays");
  assert.equal(pack.avoid.includes("sdd/memory-bank/business/loyalty/rules.md"), true);
});

test("a domain match without rule-level overlap keeps all of that domain's rules, status preserved", () => {
  const root = businessProject();
  const { resolved } = resolve(root, "Review rewards");
  const rules = idsOf(resolved).filter((id) => id.startsWith("RULE-"));
  assert.deepEqual(rules.sort(), ["RULE-LOY-001", "RULE-LOY-002", "RULE-LOY-003"]);
  assert.deepEqual(reasonsOf(resolved, "RULE-LOY-002"), ["business-domain-match"]);
  assert.equal(entryOf(resolved, "RULE-LOY-003").status, "unresolved");
  assert.equal(entryOf(resolved, "RULE-LOY-001").status, "active");
});

// ---- Explicit references / dedupe / determinism --------------------------------------

test("an explicit rule id resolves directly, expands one hop to its module, and never matches a longer id", () => {
  const root = businessProject();
  write(rulesFile(root, "payments"), `${fs.readFileSync(rulesFile(root, "payments"), "utf8")}\n## RULE-PAY-0010 — Other\n\nOther.\n\nStatus: active\n`);
  const { resolved } = resolve(root, "Explain RULE-PAY-001.");
  assert.deepEqual(idsOf(resolved).sort(), ["RULE-PAY-001", "node:module:packages/billing", "node:test-target:packages/billing"]);
  assert.deepEqual(reasonsOf(resolved, "RULE-PAY-001"), ["explicit-reference"]);
  assert.equal(resolved[0].knowledgeId, "RULE-PAY-001", "explicit references sort first");
});

test("multiple discovery paths merge into one entry with every reason, in a deterministic order", () => {
  const root = businessProject();
  const first = resolve(root, "Fix expired points RULE-LOY-001");
  const second = resolve(root, "Fix expired points RULE-LOY-001");
  assert.deepEqual(first.resolved, second.resolved);
  assert.equal(idsOf(first.resolved).filter((id) => id === "RULE-LOY-001").length, 1);
  assert.deepEqual(reasonsOf(first.resolved, "RULE-LOY-001"), ["explicit-reference", "business-rule-match"]);
});

// ---- Feature objects -----------------------------------------------------------------

test("an explicit AC pulls exactly the requirement it covers; siblings stay out", () => {
  const root = businessProject();
  const { resolved } = resolve(root, "Implement alpha#AC-1");
  assert.deepEqual(idsOf(resolved).filter((id) => id.startsWith("alpha#")).sort(), ["alpha#AC-1", "alpha#FR-1"]);
  assert.deepEqual(reasonsOf(resolved, "alpha#FR-1"), ["feature-relationship"]);
  assert.deepEqual(entryOf(resolved, "alpha#FR-1").reasons[0].via, "alpha#AC-1");
});

test("an explicit FR pulls the scenarios that cover it, one hop only", () => {
  const root = businessProject();
  const { resolved } = resolve(root, "Implement alpha#FR-2");
  assert.deepEqual(idsOf(resolved).filter((id) => id.startsWith("alpha#")).sort(), ["alpha#AC-2", "alpha#FR-2"]);
});

// ---- Rendering --------------------------------------------------------------------------

test("entries render exact objects: one rule section, one YAML object, one compact index record", () => {
  const root = businessProject();
  const { resolved } = resolve(root, "Fix expired points alpha#AC-1");
  const rule = entryOf(resolved, "RULE-LOY-001");
  assert.match(rule.content, /^## RULE-LOY-001 — Expiration/);
  assert.doesNotMatch(rule.content, /RULE-LOY-002|Totals round/);
  assert.equal(rule.path, "sdd/memory-bank/business/loyalty/rules.md");
  assert.equal(rule.address, "section:RULE-LOY-001");
  assert.equal(rule.provenance, "human-declared");

  const ac = entryOf(resolved, "alpha#AC-1");
  assert.deepEqual(YAML.parse(ac.content), SPEC.acceptance.scenarios[0]);
  assert.equal(ac.content.includes("Warehouse"), false);

  const record = entryOf(resolved, "node:module:packages/loyalty");
  const parsed = JSON.parse(record.content);
  assert.equal(parsed.id, "node:module:packages/loyalty");
  assert.equal(record.provenance, "repository-discovered");
  assert.equal(record.path, "repo-index");
  assert.ok(record.estimatedTokens > 0 && record.estimatedTokens < 200);
});

// ---- Repo Index / changed files ---------------------------------------------------------------

test("resolved Repo Index entries keep existing ids and never include the whole index", () => {
  const root = businessProject();
  const index = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "cache", "index", "repo-index.json"), "utf8"));
  const indexIds = new Set(index.records.map((record) => record.id));
  const { resolved } = resolve(root, "Fix expired points");
  const repoIds = resolved.filter((entry) => entry.source === "resolved" && entry.path === "repo-index").map((entry) => entry.knowledgeId);
  assert.ok(repoIds.length > 0 && repoIds.length < indexIds.size);
  for (const id of repoIds) assert.ok(indexIds.has(id), id);
});

test("a changed file selects its own module and test-target, not unrelated modules", () => {
  const root = businessProject();
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  fs.appendFileSync(path.join(root, "packages", "billing", "src", "index.js"), "export const c = 2;\n");
  const { resolved } = resolve(root, "Check the change", ["--changed"]);
  const repoIds = resolved.filter((entry) => entry.path === "repo-index").map((entry) => entry.knowledgeId).sort();
  assert.deepEqual(repoIds, ["node:module:packages/billing", "node:test-target:packages/billing"]);
  assert.deepEqual(reasonsOf(resolved, "node:module:packages/billing"), ["changed-file"]);
});

// ---- Dogfood: real Spectra knowledge ---------------------------------------------------------

test("dogfood: approval-gating task resolves FR-2, AC-2, the approval rules and module evidence, nothing else", () => {
  const root = createProject();
  fs.rmSync(path.join(sdd(root), "features"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "sdd", "features"), path.join(sdd(root), "features"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "sdd", "memory-bank", "business"), business(root), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "sdd", "memory-bank", "tech", "modules.md"), path.join(sdd(root), "memory-bank", "tech", "modules.md"));
  for (const file of ["package.json", "packages/cli/package.json", "packages/core/package.json", "packages/templates/package.json"]) {
    write(path.join(root, file), fs.readFileSync(path.join(repoRoot, file), "utf8"));
  }
  assert.equal(run(root, ["index"]).status, 0);

  const task = "Block AI-assisted implementation until implementation approval is granted.";
  const { pack, resolved } = resolve(root, task, ["--module", "packages-cli"]);
  assert.deepEqual(idsOf(resolved).sort(), ["RULE-SPE-006", "RULE-SPE-007", "RULE-SPE-011", "node:module:packages/cli", "spectra-core#AC-2", "spectra-core#FR-2"]);
  // Phase 1H: the test target is the last optional item and no longer fits the implementer's markdown budget
  // (headroom was ~15 tokens); it is excluded by budget, observably, not missing.
  assert.ok(pack.selection.excluded.some((entry) => entry.id === "node:test-target:packages/cli" && entry.exclusion === "budget"), JSON.stringify(pack.selection.excluded.map((entry) => [entry.id, entry.exclusion])));
  // Verification hardening: the seven named `test:<name>` sub-targets add optional candidates, so the optional
  // `packages/core` module no longer fits the same headroom either; it is excluded by budget, observably.
  assert.ok(pack.selection.excluded.some((entry) => entry.id === "node:module:packages/core" && entry.exclusion === "budget"));
  assert.deepEqual(reasonsOf(resolved, "spectra-core#FR-2").sort(), ["feature-match", "feature-relationship"]);
  assert.deepEqual(reasonsOf(resolved, "spectra-core#AC-2").sort(), ["feature-match", "feature-relationship"]);
  for (const excluded of ["spectra-core#FR-1", "spectra-core#AC-1", "spectra-core#NFR-1", "node:module:packages/templates", "RULE-SPE-001", "RULE-SPE-010"]) {
    assert.equal(idsOf(resolved).includes(excluded), false, excluded);
  }
  assert.equal(pack.entries.some((entry) => entry.path === "sdd/system/runtime/minimal.md"), true, "baseline policy context stays");
});

test("a canonical knowledge error degrades to whole-file routing instead of failing context", () => {
  const root = businessProject();
  write(rulesFile(root, "payments"), `${fs.readFileSync(rulesFile(root, "loyalty"), "utf8")}`);
  const { pack, resolved } = resolve(root, "Fix expired points");
  assert.equal(pack.knowledge.map, "unavailable");
  assert.match(pack.knowledge.error, /Duplicate business rule ID/);
  assert.equal(resolved.length, 0);
  assert.equal(pack.entries.some((entry) => entry.path === "sdd/memory-bank/business/loyalty/rules.md" && entry.source === "route"), true);
});

// ---- Regression --------------------------------------------------------------------------------

test("plain `context` is unchanged: no knowledge fields, no knowledge cache", () => {
  const root = businessProject();
  const result = run(root, ["context", "--role", "implementer", "--goal", "implement", "--format", "json"]);
  assert.equal(result.status, 0, result.stderr);
  const pack = JSON.parse(result.stdout);
  assert.equal("knowledge" in pack, false);
  assert.equal("route" in pack, false);
  assert.equal(pack.entries.some((entry) => entry.source === "resolved"), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "cache", "knowledge")), false);
});

test("resolution leaves canonical state, install metadata, approvals and markers untouched", () => {
  const root = businessProject();
  const snap = () => {
    const files = {};
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (full.includes(`${path.sep}cache`)) continue;
        if (entry.isDirectory()) walk(full);
        else files[path.relative(root, full)] = fs.readFileSync(full, "utf8");
      }
    };
    walk(path.join(root, ".spectra"));
    return files;
  };
  const before = snap();
  resolve(root, "Fix expired points", ["--module", "billing"]);
  assert.deepEqual(snap(), before);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "recovery")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "migration.json")), false);
});

test("refs and inline formats print exact objects and reasons", () => {
  const root = businessProject();
  const refs = run(root, ["context", "--route-task", "Fix expired points", "--format", "refs"]);
  assert.equal(refs.status, 0, refs.stderr);
  assert.match(refs.stdout, /- RULE-LOY-001 \[business-rule; business-rule-match\] sdd\/memory-bank\/business\/loyalty\/rules\.md#section:RULE-LOY-001/);
  const inline = run(root, ["context", "--route-task", "Fix expired points", "--format", "inline"]);
  assert.match(inline.stdout, /--- RULE-LOY-001 \[object\] ---\n## RULE-LOY-001 — Expiration/);
  assert.doesNotMatch(inline.stdout, /RULE-LOY-002/);
});
