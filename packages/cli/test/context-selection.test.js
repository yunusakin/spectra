// Phase 1B.2 — budget-aware selection for `spectra context --route-task`.
//
// Failure modes enumerated BEFORE implementation:
//
// Budget as a selection input
//  - optional candidates still included past the markdown budget (warning only)
//  - a lower-priority candidate outranks a higher one (changed-file module vs its
//    test-target; rule-reached module vs secondary test evidence)
//  - ordering/selection depends on discovery order instead of tier + id
// Mandatory protection
//  - an explicit reference is dropped to make room; a mandatory-only overflow
//    is silently truncated or reported as "within-budget"
//  - AC -> covered FR dropped while the AC stays (cannot interpret the AC);
//    FR -> AC treated as mandatory (it is only optional evidence)
//  - baseline/policy/route-infrastructure entries evicted for resolved objects
// Accounting
//  - totals count excluded entries, or miss fallback whole files
//  - superseded whole rule files still counted; legacy repoIndex.modules is an
//    unbudgeted second source of module context in route mode
//  - route.entries implies a whole file was included after exact replacement
// Explainability
//  - an excluded candidate disappears (no id/reasons/cost/status); excluded
//    canonical content is rendered by inline; JSON misses warnings
// Atomicity
//  - an object is cut to fit; a domain fallback silently keeps every rule
// Regression
//  - plain `context` gains selection fields or loses repoIndex.modules; schema,
//    markers, canonical files or approvals change

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

const sdd = (root) => path.join(root, ".spectra", "sdd");
const business = (root) => path.join(sdd(root), "memory-bank", "business");
const rulesFile = (root, domain) => path.join(business(root), domain, "rules.md");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const TIGHT = ["--role", "verifier", "--goal", "verify"]; // markdown budget 700

function featureSpec({ fr1 = "Customers redeem loyalty credits", ac2Given = "a parcel" } = {}) {
  return {
    metadata: { id: "alpha" },
    requirements: {
      functional: [{ id: "FR-1", statement: fr1 }, { id: "FR-2", statement: "Warehouse ships parcels" }],
      nonFunctional: []
    },
    acceptance: {
      scenarios: [
        { id: "AC-1", covers: ["FR-1"], given: "a customer", when: "they redeem", then: "credits drop" },
        { id: "AC-2", covers: ["FR-2"], given: ac2Given, when: "it ships", then: "tracking appears" }
      ]
    }
  };
}

function project({ spec = featureSpec(), affected = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-context-selection-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "spectra@example.test");
  git(root, "config", "user.name", "Spectra Test");
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  for (const [name, dir] of [["loyalty-api", "loyalty"], ["billing", "billing"]]) {
    write(path.join(root, "packages", dir, "package.json"), JSON.stringify({ name, scripts: { test: "node --test" } }));
    write(path.join(root, "packages", dir, "src", "index.js"), "export const a = 1;\n");
  }
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
  const affectedLine = affected ? "Affected Modules: loyalty-api\n" : "";
  write(rulesFile(root, "loyalty"), `# Rules\n\n## RULE-LOY-001 — Expiration\n\nExpired points cannot pay for orders.\n\nStatus: active\n${affectedLine}\n## RULE-LOY-002 — Rounding\n\nTotals round half up.\n\nStatus: active\n`);
  write(path.join(business(root), "loyalty", "unresolved.md"), "# U\n\n## RULE-LOY-003 — Grace\n\nGrace period needs a decision.\n\nStatus: unresolved\n");
  write(rulesFile(root, "payments"), "# Rules\n\n## RULE-PAY-001 — Settlement\n\nRefunds follow settlement.\n\nStatus: active\nAffected Modules: billing\n");
  write(path.join(business(root), "payments", "unresolved.md"), "# U\n");
  write(path.join(sdd(root), "features", "alpha", "feature.spec.yaml"), YAML.stringify(spec));
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

function resolve(root, task, extra = []) {
  const result = run(root, ["context", "--route-task", task, "--format", "json", ...extra]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pack = JSON.parse(result.stdout);
  const resolved = pack.entries.filter((entry) => entry.source === "resolved");
  const routingIndexes = pack.entries.filter((entry) => entry.source === "route" && /index$/.test(entry.reason) && entry.reason !== "routing policy");
  const tokens = (list) => list.reduce((sum, entry) => sum + entry.estimatedTokens, 0);
  return {
    pack,
    resolved,
    selection: pack.selection,
    ids: resolved.map((entry) => entry.knowledgeId),
    // optional exact objects excluded for budget (routing index files are reported separately)
    excludedIds: pack.selection.excluded.filter((entry) => entry.kind !== "routing-index").map((entry) => entry.id),
    // the mandatory markdown pool: neither included resolved objects nor optional routing indexes
    baselineFull: pack.totals.full - tokens(resolved) - tokens(routingIndexes)
  };
}

// Rewrites RULE-LOY-001 so its exact section costs `target` tokens.
function tuneRule(root, target, task = "Fix expired points", extra = []) {
  let length = 40;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    write(rulesFile(root, "loyalty"), `# Rules\n\n## RULE-LOY-001 — Expiration\n\nExpired points cannot pay. ${"z".repeat(length)}\n\nStatus: active\nAffected Modules: loyalty-api\n`);
    const probe = resolve(root, task, extra);
    const cost = (probe.resolved.find((entry) => entry.knowledgeId === "RULE-LOY-001") ?? probe.selection.excluded.find((entry) => entry.id === "RULE-LOY-001")).estimatedTokens;
    if (cost === target) return;
    length = Math.max(1, length + (target - cost) * 4);
  }
  assert.fail(`could not tune rule to ${target} tokens`);
}

const MODULE = "node:module:packages/loyalty";
const TEST_TARGET = "node:test-target:packages/loyalty";

// ---- Case A: everything fits ---------------------------------------------------------

test("everything fits: all relevant candidates included, nothing excluded, whole rule file superseded", () => {
  const root = project();
  const { pack, selection, ids } = resolve(root, "Fix expired points");
  assert.deepEqual(ids.sort(), ["RULE-LOY-001", MODULE, TEST_TARGET].sort());
  assert.equal(selection.status, "within-budget");
  assert.deepEqual(selection.excluded, []);
  assert.deepEqual(selection.warnings, []);
  assert.equal(selection.full.used, pack.totals.full);
  assert.equal(selection.summary.used, pack.totals.summary);
  assert.equal(selection.full.budget, pack.budgets.markdownTokens);
  assert.equal(selection.full.remaining, selection.full.budget - selection.full.used);
  assert.deepEqual(selection.superseded.map((entry) => entry.path).sort(), ["sdd/memory-bank/business/loyalty/rules.md", "sdd/memory-bank/business/loyalty/unresolved.md"]);
  assert.ok(selection.superseded.every((entry) => entry.estimatedTokens > 0));
  assert.equal(selection.candidates.count, 3);
});

// ---- Case B: optional candidates do not fit; module outranks secondary test evidence -----------

test("optional candidates that do not fit are excluded in tier order and stay observable", () => {
  const root = project();
  const probe = resolve(root, "Fix expired points", TIGHT);
  const mod = probe.resolved.find((entry) => entry.knowledgeId === MODULE).estimatedTokens;
  const testTarget = probe.resolved.find((entry) => entry.knowledgeId === TEST_TARGET).estimatedTokens;
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  assert.ok(room > mod + testTarget, `fixture needs room, got ${room}`);

  tuneRule(root, room - mod - Math.floor(testTarget / 2), "Fix expired points", TIGHT);
  const { selection, ids, pack, excludedIds } = resolve(root, "Fix expired points", TIGHT);
  assert.deepEqual(ids.sort(), ["RULE-LOY-001", MODULE].sort());
  assert.deepEqual(excludedIds, [TEST_TARGET]);
  const excluded = selection.excluded[0];
  assert.equal(excluded.exclusion, "budget");
  assert.equal(excluded.estimatedTokens, testTarget);
  assert.deepEqual(excluded.reasons.map(({ reason }) => reason), ["repo-index-evidence"]);
  assert.equal(excluded.required, false);
  assert.equal(selection.status, "budget-exhausted");
  assert.deepEqual(selection.warnings.map((warning) => warning.code), ["optional-excluded"]);
  assert.ok(selection.full.used <= selection.full.budget);
  assert.equal(selection.full.used, pack.totals.full, "excluded entries never count");
  assert.equal(pack.entries.some((entry) => entry.knowledgeId === TEST_TARGET), false);
});

test("evidence is dropped with its anchor even when it would fit", () => {
  const root = project();
  const probe = resolve(root, "Fix expired points", TIGHT);
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  tuneRule(root, room + 20, "Fix expired points", TIGHT);
  const { ids, selection } = resolve(root, "Fix expired points", TIGHT);
  assert.deepEqual(ids, [], "the rule does not fit, so neither does evidence that only hangs off it");
  const byId = Object.fromEntries(selection.excluded.map((entry) => [entry.id, entry.exclusion]));
  assert.equal(byId["RULE-LOY-001"], "budget");
  assert.equal(byId[MODULE], "anchor-excluded");
  assert.equal(byId[TEST_TARGET], "anchor-excluded");
  assert.equal(selection.status, "budget-exhausted");
});

// ---- Case C / explicit references: mandatory overflow ---------------------------------------------

test("an explicit reference larger than the budget is still returned with mandatory-overflow", () => {
  const root = project();
  const probe = resolve(root, "Explain RULE-LOY-001", TIGHT);
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  tuneRule(root, room + 60, "Explain RULE-LOY-001", TIGHT);
  const { selection, ids, resolved, excludedIds, pack } = resolve(root, "Explain RULE-LOY-001", TIGHT);
  assert.deepEqual(ids, ["RULE-LOY-001"], "explicit rule kept, optional technical evidence dropped");
  assert.equal(resolved[0].required, true);
  assert.deepEqual(excludedIds.sort(), [MODULE, TEST_TARGET].sort());
  assert.equal(selection.status, "mandatory-overflow");
  assert.ok(selection.full.used > selection.full.budget);
  assert.ok(selection.full.remaining < 0);
  assert.ok(selection.warnings.some((warning) => warning.code === "mandatory-overflow"));
  assert.match(resolved[0].content, /z{40,}/, "the object is never truncated");
  assert.equal(selection.full.used, pack.totals.full);
});

test("an explicit reference that fits survives while optional evidence is dropped", () => {
  const root = project();
  const probe = resolve(root, "Explain RULE-LOY-001", TIGHT);
  const rule = probe.resolved.find((entry) => entry.knowledgeId === "RULE-LOY-001").estimatedTokens;
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  tuneRule(root, room - 5, "Explain RULE-LOY-001", TIGHT);
  const { selection, ids } = resolve(root, "Explain RULE-LOY-001", TIGHT);
  assert.ok(rule < room - 5);
  assert.deepEqual(ids, ["RULE-LOY-001"]);
  assert.equal(selection.status, "budget-exhausted");
});

// ---- Relationships: AC -> FR is required to interpret, FR -> AC is optional -----------------------

test("an explicit AC keeps the FR it covers even when that overflows the budget", () => {
  const root = project({ spec: featureSpec({ fr1: `Customers redeem loyalty credits ${"detail ".repeat(400)}` }) });
  const { selection, ids, resolved } = resolve(root, "Implement alpha#AC-1", TIGHT);
  assert.deepEqual(ids.filter((id) => id.startsWith("alpha#")).sort(), ["alpha#AC-1", "alpha#FR-1"]);
  assert.equal(resolved.find((entry) => entry.knowledgeId === "alpha#FR-1").required, true);
  assert.equal(selection.status, "mandatory-overflow");
});

test("an explicit FR does not make the covering AC mandatory", () => {
  const root = project({ spec: featureSpec({ ac2Given: `a parcel ${"detail ".repeat(400)}` }) });
  const { selection, ids, excludedIds, resolved } = resolve(root, "Implement alpha#FR-2", TIGHT);
  assert.deepEqual(ids.filter((id) => id.startsWith("alpha#")), ["alpha#FR-2"]);
  assert.equal(resolved[0].required, true);
  assert.deepEqual(excludedIds, ["alpha#AC-2"]);
  assert.equal(selection.excluded[0].required, false);
  assert.equal(selection.status, "budget-exhausted");
});

// ---- Case D: exact object vs whole file ----------------------------------------------------------

test("exact objects replace the larger whole rule file in the budget", () => {
  const root = project();
  write(rulesFile(root, "loyalty"), `${fs.readFileSync(rulesFile(root, "loyalty"), "utf8")}\n## RULE-LOY-009 — Filler\n\n${"padding ".repeat(600)}\n\nStatus: active\n`);
  const { pack, selection } = resolve(root, "Fix expired points");
  const whole = selection.superseded.find((entry) => entry.path.endsWith("loyalty/rules.md"));
  assert.ok(whole.estimatedTokens > 1000);
  assert.equal(pack.entries.some((entry) => entry.path.endsWith("loyalty/rules.md") && entry.source === "route"), false);
  assert.ok(pack.totals.full < whole.estimatedTokens + 1000);
  assert.equal(selection.status, "within-budget");
});

// ---- Case E: fallback whole files participate in accounting ----------------------------------------------

test("fallback whole-file routing is accounted for, visible and never dropped", () => {
  const root = project();
  write(rulesFile(root, "payments"), `${fs.readFileSync(rulesFile(root, "loyalty"), "utf8")}\n## RULE-LOY-009 — Filler\n\n${"padding ".repeat(600)}\n\nStatus: active\n`);
  const { pack, selection, resolved } = resolve(root, "Fix expired points");
  assert.equal(pack.knowledge.map, "unavailable");
  assert.equal(resolved.length, 0);
  const whole = pack.entries.find((entry) => entry.path.endsWith("loyalty/rules.md"));
  assert.ok(whole, "fallback keeps whole files");
  assert.ok(selection.included.some((entry) => entry.id === whole.path && entry.required === true));
  assert.equal(selection.full.used, pack.totals.full);
  assert.ok(selection.warnings.some((warning) => warning.code === "exact-resolution-unavailable"));
  assert.deepEqual(selection.superseded, []);
});

// ---- Business domain fallback under a tight budget ------------------------------------------------

test("domain fallback keeps rules in id order, drops what does not fit and preserves status", () => {
  const root = project({ affected: false });
  const filler = "detail ".repeat(60);
  write(rulesFile(root, "loyalty"), ["# Rules", "", ...["001", "002"].flatMap((n) => [`## RULE-LOY-${n} — Item`, "", filler, "", "Status: active", ""])].join("\n"));
  write(path.join(business(root), "loyalty", "unresolved.md"), `# U\n\n## RULE-LOY-003 — Grace\n\n${filler}\n\nStatus: unresolved\n`);
  const probe = resolve(root, "Review rewards", TIGHT);
  const each = probe.resolved.find((entry) => entry.knowledgeId === "RULE-LOY-001").estimatedTokens;
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  assert.ok(room >= each && room < each * 3, `fixture room ${room} for ${each}`);
  const fits = Math.floor(room / each);
  const rules = probe.ids.filter((id) => id.startsWith("RULE-"));
  assert.deepEqual(rules, ["RULE-LOY-001", "RULE-LOY-002", "RULE-LOY-003"].slice(0, fits));
  const excluded = probe.selection.excluded.filter((entry) => entry.kind !== "routing-index");
  assert.deepEqual(excluded.map((entry) => entry.id), ["RULE-LOY-001", "RULE-LOY-002", "RULE-LOY-003"].slice(fits));
  assert.ok(excluded.every((entry) => entry.reasons[0].reason === "business-domain-match"));
  if (fits < 3) assert.equal(excluded.at(-1).status, "unresolved");
  assert.equal(probe.selection.status, "budget-exhausted");
});

test("domain-fallback rules keep their affected module and test evidence when budget allows", () => {
  const root = project();
  const { ids, selection } = resolve(root, "Review rewards");
  assert.deepEqual(ids.filter((id) => !id.startsWith("RULE-")).sort(), [MODULE, TEST_TARGET].sort());
  assert.equal(selection.status, "within-budget");
  assert.deepEqual(selection.excluded, []);
});

// ---- Changed files ----------------------------------------------------------------------------------

test("the changed file's owning module survives before its secondary test-target", () => {
  const root = project();
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  fs.appendFileSync(path.join(root, "packages", "billing", "src", "index.js"), "export const c = 2;\n");
  const args = ["--changed", ...TIGHT];
  const probe = resolve(root, "Check the change", args);
  const mod = probe.resolved.find((entry) => entry.knowledgeId === "node:module:packages/billing").estimatedTokens;
  const testTarget = probe.resolved.find((entry) => entry.knowledgeId === "node:test-target:packages/billing").estimatedTokens;
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  const padding = (room - mod - Math.floor(testTarget / 2)) * 4;
  assert.ok(padding > 0);
  // minimal.md is the (required) routing policy; padding it shrinks the room deterministically.
  fs.appendFileSync(path.join(sdd(root), "system", "runtime", "minimal.md"), `\n${"x".repeat(padding)}\n`);
  const { ids, excludedIds, selection } = resolve(root, "Check the change", args);
  assert.deepEqual(ids, ["node:module:packages/billing"]);
  assert.deepEqual(excludedIds, ["node:test-target:packages/billing"]);
  assert.equal(selection.status, "budget-exhausted");
});

// ---- Routing indexes are optional, the routing policy is not ----------------------------------------

test("module/domain index files are the lowest optional tier; the routing policy stays required", () => {
  const root = project();
  const probe = resolve(root, "Explain RULE-LOY-001", TIGHT);
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  tuneRule(root, room - 20, "Explain RULE-LOY-001", TIGHT);
  const { pack, selection } = resolve(root, "Explain RULE-LOY-001", TIGHT);
  const dropped = selection.excluded.filter((entry) => entry.kind === "routing-index").map((entry) => entry.id).sort();
  assert.deepEqual(dropped, ["sdd/memory-bank/business/INDEX.md", "sdd/memory-bank/tech/modules.md"]);
  assert.equal(pack.entries.some((entry) => entry.path === "sdd/system/runtime/minimal.md"), true);
  assert.ok(selection.included.find((entry) => entry.id === "sdd/system/runtime/minimal.md").required);
  const status = Object.fromEntries(pack.route.entries.map((entry) => [entry.path, entry.selection]));
  assert.equal(status["sdd/memory-bank/tech/modules.md"], "excluded-by-budget");
  assert.equal(status["sdd/system/runtime/minimal.md"], "included");
  assert.equal(selection.full.used, pack.totals.full);
});

// ---- Legacy repoIndex / route metadata ----------------------------------------------------------------

test("route mode no longer exposes the unbudgeted module list; plain context keeps it", () => {
  const root = project();
  const { pack } = resolve(root, "Fix expired points");
  assert.equal("modules" in pack.repoIndex, false);
  assert.equal(pack.repoIndex.available, true);
  assert.ok(pack.repoIndex.stats.total > 0);
  assert.ok(pack.repoIndex.hint);
  const plain = JSON.parse(run(root, ["context", "--role", "implementer", "--goal", "implement", "--format", "json"]).stdout);
  assert.ok(plain.repoIndex.modules.length > 0);
  assert.equal("selection" in plain, false);
});

test("route metadata marks replaced whole files instead of implying inclusion", () => {
  const root = project();
  const { pack } = resolve(root, "Fix expired points");
  const status = Object.fromEntries(pack.route.entries.map((entry) => [entry.path, entry.selection]));
  assert.equal(status["sdd/memory-bank/business/loyalty/rules.md"], "superseded-by-exact-object");
  assert.equal(status["sdd/memory-bank/business/INDEX.md"], "included");
  for (const entry of pack.route.entries) {
    assert.equal(pack.entries.some((candidate) => candidate.source !== "resolved" && candidate.path === entry.path), entry.selection === "included", entry.path);
  }
});

// ---- Determinism and output formats --------------------------------------------------------------------

test("selection is deterministic across runs", () => {
  const root = project();
  const first = resolve(root, "Fix expired points alpha#AC-1 loyalty redeem credits", TIGHT).selection;
  const second = resolve(root, "Fix expired points alpha#AC-1 loyalty redeem credits", TIGHT).selection;
  assert.deepEqual(first, second);
});

test("refs and inline summarize the budget; inline never renders excluded content", () => {
  const root = project();
  const probe = resolve(root, "Fix expired points", TIGHT);
  const mod = probe.resolved.find((entry) => entry.knowledgeId === MODULE).estimatedTokens;
  const room = probe.pack.budgets.markdownTokens - probe.baselineFull;
  tuneRule(root, room - mod - 1, "Fix expired points", TIGHT);
  const refs = run(root, ["context", "--route-task", "Fix expired points", "--format", "refs", ...TIGHT]);
  assert.match(refs.stdout, /Selection: budget-exhausted \(full \d+\/700, summary \d+\/\d+\)/);
  assert.match(refs.stdout, new RegExp(`Excluded:\\n- ${TEST_TARGET} \\[budget; repo-index-evidence;`));
  const inline = run(root, ["context", "--route-task", "Fix expired points", "--format", "inline", ...TIGHT]);
  assert.match(inline.stdout, /Selection: budget-exhausted/);
  assert.match(inline.stdout, /--- RULE-LOY-001 \[object\] ---/);
  assert.doesNotMatch(inline.stdout, /--- node:test-target:packages\/loyalty/);
  assert.doesNotMatch(inline.stdout, /"kind":"test-target"/);
});

test("refs and inline carry selection warnings on stdout, not only stderr", () => {
  const root = project();
  write(rulesFile(root, "payments"), fs.readFileSync(rulesFile(root, "loyalty"), "utf8"));
  for (const format of ["refs", "inline"]) {
    const result = run(root, ["context", "--route-task", "Fix expired points", "--format", format]);
    assert.match(result.stdout, /WARN Knowledge Map unavailable, using whole-file routing: Duplicate business rule ID/, format);
  }
  const clean = project();
  tuneRule(clean, 900, "Explain RULE-LOY-001", TIGHT);
  const overflow = run(clean, ["context", "--route-task", "Explain RULE-LOY-001", "--format", "refs", ...TIGHT]);
  assert.match(overflow.stdout, /WARN Mandatory context exceeds the budget/);
});

// ---- Dogfood -----------------------------------------------------------------------------------------------

test("dogfood: approval-gating task is a within-budget selection with nothing required or excluded", () => {
  const repoRoot = path.resolve(cliRoot, "..", "..");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-selection-dogfood-"));
  git(root, "init", "-q");
  assert.equal(run(root, ["init", "."]).status, 0);
  fs.rmSync(path.join(sdd(root), "features"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "sdd", "features"), path.join(sdd(root), "features"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "sdd", "memory-bank", "business"), business(root), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "sdd", "memory-bank", "tech", "modules.md"), path.join(sdd(root), "memory-bank", "tech", "modules.md"));
  for (const file of ["package.json", "packages/cli/package.json", "packages/core/package.json", "packages/templates/package.json"]) {
    write(path.join(root, file), fs.readFileSync(path.join(repoRoot, file), "utf8"));
  }
  assert.equal(run(root, ["index"]).status, 0);
  const task = "Block AI-assisted implementation until implementation approval is granted.";
  const { selection, ids } = resolve(root, task, ["--module", "packages-cli"]);
  assert.deepEqual(ids.sort(), ["node:module:packages/cli", "node:test-target:packages/cli", "spectra-core#AC-2", "spectra-core#FR-2"]);
  assert.equal(selection.status, "within-budget");
  assert.deepEqual(selection.excluded, []);
  assert.equal(selection.included.filter((entry) => entry.required && entry.id.startsWith("spectra-core#")).length, 0);
});

// ---- Regression ----------------------------------------------------------------------------------------------

test("selection leaves canonical state, markers and plain context untouched", () => {
  const root = project();
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
  const plain = JSON.parse(run(root, ["context", "--role", "implementer", "--goal", "implement", "--format", "json"]).stdout);
  assert.equal("knowledge" in plain, false);
  assert.equal("selection" in plain, false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "cache", "knowledge")), false);
  resolve(root, "Explain RULE-LOY-001", TIGHT);
  assert.deepEqual(snap(), before);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "recovery")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "migration.json")), false);
});
