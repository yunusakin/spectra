// Phase 1E — deterministic retrieval tuning, end to end through the real CLI
// (`spectra context --route-task --format json`).
//
// Failure modes enumerated BEFORE any retrieval code was changed:
//
// Weak lexical evidence
//  - a rule becomes a candidate only because its metadata lines (Evidence paths,
//    `Affected Modules`, Status, Confidence) share a word with the task
//  - a word that every rule of a domain contains (so it cannot tell rules apart)
//    still selects the whole domain
//  - generic phrases ("change the project", "update the package", "require a
//    command") independently imply a large set of rules
// Domain routing
//  - a module hint (`--module`, or a module named in the task) expands into every
//    business rule of the module's domain
//  - an explicit `--domain` loses its broad meaning, or a strong domain keyword
//    with no rule-level overlap stops falling back to the domain's rules
//  - the module -> domain tier is removed from the route (it must still route)
// Safety
//  - an explicit reference is no longer required/exact, or collides by prefix
//  - an acceptance scenario loses the requirement it covers
//  - the strong repository evidence (rule -> affected module -> test-target)
//    disappears while the weak lexical signal is being fixed
// Determinism and explainability
//  - candidate order, reasons or exclusion reasons depend on iteration order or
//    differ between identical runs
//  - a candidate loses its reason (every candidate must say why it is there)
// Freshness
//  - a Knowledge Map cached before the tuning keeps its old lookup terms
//
// The test ends by writing a repeatable artifact (the observed candidates per
// task) and reporting its path as a test diagnostic.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const sdd = (root) => path.join(root, ".spectra", "sdd");

// A "platform" domain with eight rules. Every rule carries the same metadata
// words (`packages/cli` evidence paths, `Affected Modules: platform-cli`), and
// every statement says "the system", so neither can tell the rules apart.
// A second, unrelated domain checks that routing stays domain-scoped.
const RULES = [
  ["RULE-PLT-001", "Explicit migration", "The system changes project layout only through the explicit migrate command."],
  ["RULE-PLT-002", "Derived caches", "The system rebuilds a stale cache from canonical files and never trusts it."],
  ["RULE-PLT-003", "Approval gates", "The system requires approval before application code changes."],
  ["RULE-PLT-004", "Uninstall scope", "The system uninstall removes only machine-owned installations."],
  ["RULE-PLT-005", "Stable identity", "The system addresses objects by stable identity, never by file position."],
  ["RULE-PLT-006", "Budget selection", "The system drops optional context when the token budget is exceeded."],
  ["RULE-PLT-007", "Machine update", "The system update refreshes the machine application and never the project."],
  ["RULE-PLT-008", "Release notes", "The system generates release notes from tagged commits."]
];
const PLATFORM_IDS = RULES.map(([id]) => id);

function ruleSection([id, title, statement]) {
  return `## ${id} — ${title}\n\n${statement}\n\nStatus: active\nAffected Modules: platform-cli\nEvidence: packages/cli/src/commands/${title.split(" ")[0].toLowerCase()}.js; packages/cli/test/${id.toLowerCase()}.test.js\nConfidence: high\n`;
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-retrieval-tuning-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "spectra@example.test");
  git(root, "config", "user.name", "Spectra Test");
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "platform", private: true, workspaces: ["packages/*"] }));
  for (const [name, dir] of [["platform-cli", "cli"], ["billing", "billing"]]) {
    write(path.join(root, "packages", dir, "package.json"), JSON.stringify({ name, scripts: { test: "node --test" } }));
    write(path.join(root, "packages", dir, "src", "index.js"), "export const a = 1;\n");
  }
  const memory = path.join(sdd(root), "memory-bank");
  write(path.join(memory, "tech", "modules.md"), [
    "# Technical Module Index", "",
    "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| platform-cli | Command line | packages/cli/ | platform |",
    "| billing | Billing | packages/billing/ | payments |", ""
  ].join("\n"));
  write(path.join(memory, "business", "INDEX.md"), [
    "# Business Domain Index", "",
    "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| platform | release,governance | business/platform/rules.md | business/platform/unresolved.md | platform-cli |",
    "| payments | refunds | business/payments/rules.md | business/payments/unresolved.md | billing |", ""
  ].join("\n"));
  write(path.join(memory, "business", "platform", "rules.md"), `# Rules\n\n${RULES.map(ruleSection).join("\n")}`);
  write(path.join(memory, "business", "platform", "unresolved.md"), "# U\n");
  write(path.join(memory, "business", "payments", "rules.md"), "# Rules\n\n## RULE-PAY-001 — Settlement\n\nRefunds follow settlement cycles.\n\nStatus: active\nAffected Modules: billing\n");
  write(path.join(memory, "business", "payments", "unresolved.md"), "# U\n");
  write(path.join(sdd(root), "features", "alpha", "feature.spec.yaml"), YAML.stringify({
    metadata: { id: "alpha" },
    requirements: { functional: [{ id: "FR-1", statement: "Operators approve changes before shipping" }], nonFunctional: [] },
    acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "a change", when: "an operator approves", then: "shipping continues" }] }
  }));
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

function resolve(root, task, extra = []) {
  const result = run(root, ["context", "--route-task", task, "--format", "json", ...extra]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pack = JSON.parse(result.stdout);
  const resolved = pack.entries.filter((entry) => entry.source === "resolved");
  const excluded = pack.selection.excluded.filter((entry) => entry.kind !== "routing-index");
  const candidates = [...resolved, ...excluded];
  return {
    pack,
    resolved,
    // every candidate, whether it fit the budget or not: lexical quality is independent of budget
    candidateIds: candidates.map((entry) => entry.knowledgeId ?? entry.id),
    ruleIds: candidates.map((entry) => entry.knowledgeId ?? entry.id).filter((id) => id.startsWith("RULE-")),
    reasonsOf: (id) => (candidates.find((entry) => (entry.knowledgeId ?? entry.id) === id)?.reasons ?? []).map(({ reason }) => reason)
  };
}

const observed = {};
const record = (name, outcome) => {
  observed[name] = { candidates: outcome.candidateIds, rules: outcome.ruleIds };
};

test("metadata lines (Evidence paths, Affected Modules) are not lexical evidence", () => {
  const root = project();
  // `package` appears in every rule's Evidence path only; `update` is in exactly one statement
  const outcome = resolve(root, "Update the package", ["--module", "platform-cli"]);
  record("update-the-package", outcome);
  assert.deepEqual(outcome.ruleIds, ["RULE-PLT-007"]);
});

test("a word every rule of the domain contains does not select the domain's rules", () => {
  const root = project();
  // `release` routes to the platform domain; `system` is in all eight statements
  const outcome = resolve(root, "Release the system");
  record("release-the-system", outcome);
  assert.deepEqual(outcome.ruleIds, ["RULE-PLT-008"]);
  assert.deepEqual(outcome.reasonsOf("RULE-PLT-008"), ["business-rule-match"]);
});

test("generic phrases do not independently imply a large set of rules", () => {
  const root = project();
  for (const task of ["Change the project", "Update the package", "Require a command"]) {
    const outcome = resolve(root, task, ["--module", "platform-cli"]);
    record(task.toLowerCase().replaceAll(" ", "-"), outcome);
    // fewer than half of the domain's rules, never through the whole-domain fallback...
    assert.ok(outcome.ruleIds.length * 2 < PLATFORM_IDS.length, `${task}: ${outcome.ruleIds.join(",")}`);
    for (const id of outcome.ruleIds) assert.deepEqual(outcome.reasonsOf(id), ["business-rule-match"], `${task}: ${id}`);
    // ...and every selected rule really says one of the task's words (not just its metadata)
    const words = task.toLowerCase().split(" ").filter((word) => word.length >= 5);
    for (const id of outcome.ruleIds) {
      const statement = RULES.find(([ruleId]) => ruleId === id)[2].toLowerCase();
      assert.ok(words.some((word) => statement.includes(word.replace(/s$/, ""))), `${task}: ${id} has none of ${words.join(",")} in its statement`);
    }
  }
});

test("a module hint alone does not expand into the module's whole business domain", () => {
  const root = project();
  const outcome = resolve(root, "Tune the nightly job", ["--module", "platform-cli"]);
  record("module-hint-only", outcome);
  assert.deepEqual(outcome.ruleIds, []);
  // the technical evidence for the hinted module is unaffected
  assert.ok(outcome.candidateIds.includes("node:module:packages/cli"));
  assert.ok(outcome.candidateIds.includes("node:test-target:packages/cli"));
});

test("a strong domain keyword with no rule-level overlap still falls back to the domain's rules", () => {
  const root = project();
  const outcome = resolve(root, "Review governance posture");
  record("domain-keyword-fallback", outcome);
  assert.deepEqual([...outcome.ruleIds].sort(), PLATFORM_IDS);
  for (const id of PLATFORM_IDS) assert.deepEqual(outcome.reasonsOf(id), ["business-domain-match"]);
});

test("an explicit --domain keeps its broad meaning", () => {
  const root = project();
  const outcome = resolve(root, "Tune the nightly job", ["--domain", "platform"]);
  record("explicit-domain", outcome);
  assert.deepEqual([...outcome.ruleIds].sort(), PLATFORM_IDS);
});

test("an unrelated task still produces no project knowledge", () => {
  const root = project();
  const outcome = resolve(root, "Add dark mode toggle to the marketing website header");
  record("unrelated", outcome);
  assert.deepEqual(outcome.candidateIds, []);
});

test("explicit references stay exact, required and atomic", () => {
  const root = project();
  const outcome = resolve(root, "Explain RULE-PLT-003");
  record("explicit-rule", outcome);
  const rule = outcome.resolved.find((entry) => entry.knowledgeId === "RULE-PLT-003");
  assert.equal(rule.required, true);
  assert.equal(rule.priority, 0);
  assert.deepEqual(outcome.ruleIds, ["RULE-PLT-003"]);

  const scenario = resolve(root, "Implement alpha#AC-1");
  record("explicit-ac", scenario);
  assert.equal(scenario.resolved.find((entry) => entry.knowledgeId === "alpha#AC-1").required, true);
  assert.equal(scenario.resolved.find((entry) => entry.knowledgeId === "alpha#FR-1").required, true);
});

test("a rule still reaches its affected module and test target", () => {
  const root = project();
  const outcome = resolve(root, "Explain RULE-PLT-003");
  assert.deepEqual(outcome.reasonsOf("node:module:packages/cli"), ["repo-index-evidence"]);
  assert.deepEqual(outcome.reasonsOf("node:test-target:packages/cli"), ["repo-index-evidence"]);
});

test("every candidate explains itself and identical runs are identical", () => {
  const root = project();
  for (const [task, extra] of [["Update the package", ["--module", "platform-cli"]], ["Review governance posture", []], ["Release the system", []]]) {
    const first = resolve(root, task, extra);
    for (const entry of first.resolved) assert.ok(entry.reasons.length > 0 && entry.reasons.every(({ reason }) => typeof reason === "string"), `${task}: ${entry.knowledgeId}`);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const again = resolve(root, task, extra);
      assert.deepEqual(again.pack.entries.map((entry) => ({ id: entry.knowledgeId ?? entry.path, reasons: entry.reasons ?? null, required: entry.required ?? null })), first.pack.entries.map((entry) => ({ id: entry.knowledgeId ?? entry.path, reasons: entry.reasons ?? null, required: entry.required ?? null })));
      assert.deepEqual(again.pack.selection.excluded, first.pack.selection.excluded);
      assert.deepEqual(again.pack.selection.included, first.pack.selection.included);
    }
  }
});

test("a Knowledge Map cached by an earlier contract is rebuilt, not trusted", () => {
  const root = project();
  resolve(root, "Explain RULE-PLT-003"); // the first route-task resolution writes the cached map
  const mapPath = path.join(root, ".spectra", "cache", "knowledge", "knowledge-map.json");
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  // a cache written before this tuning (contract 2): same sources, terms that still include metadata words
  map.contractVersion = 2;
  for (const reference of map.references) if (reference.kind === "business-rule") reference.terms = [...(reference.terms ?? []), "package"].sort();
  fs.writeFileSync(mapPath, JSON.stringify(map));
  const outcome = resolve(root, "Update the package", ["--module", "platform-cli"]);
  assert.deepEqual(outcome.ruleIds, ["RULE-PLT-007"]);
});

test("retrieval tuning artifact: the observed candidates per task", (t) => {
  assert.ok(Object.keys(observed).length >= 8, "run the whole file so the artifact is complete");
  const artifact = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-retrieval-artifact-")), "retrieval-tuning.json");
  fs.writeFileSync(artifact, `${JSON.stringify(observed, null, 2)}\n`);
  t.diagnostic(`Retrieval artifact: ${artifact}`);
  assert.deepEqual(JSON.parse(fs.readFileSync(artifact, "utf8")), observed);
});
