// Phase 1E — deterministic retrieval tuning.
//
// Failure modes enumerated BEFORE the change (measured in the Phase 1C/1D corpus):
//  - metadata lines of a rule (Status / Affected Modules / Evidence / Confidence) contribute match terms,
//    so path and tool names in Evidence ("packages", "commit") select unrelated rules
//  - the title and prose of a rule stop matching after metadata is excluded
//  - a domain reached only through a module's business-domains list expands to every rule of the domain
//  - the fix over-corrects: an explicit --domain, the domain name or a configured keyword no longer
//    falls back to the domain's rules when no rule shares a term
//  - a map cached with the old term contract is still trusted as fresh
//  - explicit references, module evidence or determinism change

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildKnowledgeMap, getKnowledgeMapPath, loadKnowledgeMap, lookupKnowledgeReference, writeKnowledgeMap } from "../src/lib/knowledge/map.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");
const run = (cwd, args) => spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const sdd = (root) => path.join(root, ".spectra", "sdd");
const business = (root) => path.join(sdd(root), "memory-bank", "business");
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-retrieval-tuning-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  for (const [name, dir] of [["ledger-api", "ledger"], ["billing", "billing"]]) {
    write(path.join(root, "packages", dir, "package.json"), JSON.stringify({ name, scripts: { test: "node --test" } }));
    write(path.join(root, "packages", dir, "src", "index.js"), "export const a = 1;\n");
  }
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "",
    "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| ledger-api | Ledger | packages/ledger/ | ledger |",
    "| billing | Billing | packages/billing/ | payments |", ""
  ].join("\n"));
  write(path.join(business(root), "INDEX.md"), [
    "# Business Domain Index", "",
    "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| ledger | journal,posting | business/ledger/rules.md | business/ledger/unresolved.md | ledger-api |",
    "| payments | refunds | business/payments/rules.md | business/payments/unresolved.md | billing |", ""
  ].join("\n"));
  write(path.join(business(root), "ledger", "rules.md"), [
    "# Rules", "",
    "## RULE-LED-001 — Posting immutability", "", "Posted journal entries are never edited, only reversed.", "",
    "Status: active", "Affected Modules: ledger-api", "Evidence: packages/ledger/src/index.js; commit 1a2b3c; command audit", "Confidence: high", "",
    "## RULE-LED-002 — Reconciliation", "", "Balances reconcile nightly against the bank statement.", "",
    "Status: active", "Evidence: packages/ledger/test; commit 4d5e6f", "Confidence: high", ""
  ].join("\n"));
  write(path.join(business(root), "ledger", "unresolved.md"), "# U\n");
  write(path.join(business(root), "payments", "rules.md"), [
    "# Rules", "",
    "## RULE-PAY-001 — Settlement", "", "Refunds follow settlement cycles.", "", "Status: active", "Affected Modules: billing", "",
    "## RULE-PAY-002 — Chargebacks", "", "Chargebacks freeze the disputed amount.", "", "Status: active", ""
  ].join("\n"));
  write(path.join(business(root), "payments", "unresolved.md"), "# U\n");
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

function candidates(root, task, extra = []) {
  const result = run(root, ["context", "--route-task", task, "--format", "json", ...extra]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pack = JSON.parse(result.stdout);
  const resolved = pack.entries.filter((entry) => entry.source === "resolved").map((entry) => ({ id: entry.knowledgeId, reasons: entry.reasons }));
  return [...resolved, ...pack.selection.excluded.filter((entry) => entry.reasons)];
}
const ids = (list) => list.map((entry) => entry.id).filter((id) => !/\.md$/.test(id) && !id.startsWith("sdd/"));

test("rule metadata values do not contribute match terms; title and prose still do", () => {
  const root = project();
  const rule = lookupKnowledgeReference(buildKnowledgeMap(root), "RULE-LED-001");
  assert.ok(rule.terms.includes("journal") && rule.terms.includes("posting") && rule.terms.includes("reversed"));
  for (const leaked of ["commit", "command", "audit", "package", "ledger"]) assert.equal(rule.terms.includes(leaked), false, leaked);
});

test("a task naming only evidence vocabulary is not a rule-level match", () => {
  const root = project();
  const entry = candidates(root, "Review the commit audit command for the ledger package").find((candidate) => candidate.id === "RULE-LED-001");
  assert.equal(entry?.reasons?.some((reason) => reason.reason === "business-rule-match") ?? false, false);
});

test("a domain reached only through a module's business domains does not expand to every rule", () => {
  const root = project();
  const selected = ids(candidates(root, "Tune the nightly job", ["--module", "billing"]));
  assert.deepEqual(selected.filter((id) => id.startsWith("RULE-")), []);
  assert.ok(selected.includes("node:module:packages/billing"), "module evidence is kept");
});

test("an explicit domain, the domain keyword and an exact rule term keep their behaviour", () => {
  const root = project();
  const explicit = ids(candidates(root, "Tune the nightly job", ["--domain", "payments"]));
  assert.deepEqual(explicit.filter((id) => id.startsWith("RULE-")).sort(), ["RULE-PAY-001", "RULE-PAY-002"]);
  const keyword = ids(candidates(root, "Review refunds behaviour"));
  assert.ok(keyword.includes("RULE-PAY-001"), "keyword-matched domain still selects its rules");
  const exact = ids(candidates(root, "Explain RULE-LED-002"));
  assert.ok(exact.includes("RULE-LED-002"));
});

test("an explicit reference does not also trigger whole-domain fallback", () => {
  const root = project();
  const selected = ids(candidates(root, "Explain RULE-PAY-001 for payments"));
  assert.deepEqual(selected.filter((id) => id.startsWith("RULE-")), ["RULE-PAY-001"]);
});

test("a single shared term does not join rules that share more terms, but still matches when it is the best available", () => {
  const root = project();
  const strong = candidates(root, "Review journal posting for the bank", ["--domain", "ledger"]);
  const picked = (list) => list.filter((entry) => entry.id.startsWith("RULE-")).map((entry) => `${entry.id}:${entry.reasons.map((reason) => reason.reason)}`);
  assert.deepEqual(picked(strong), ["RULE-LED-001:business-rule-match"]);
  const weak = candidates(root, "Review the bank", ["--domain", "ledger"]);
  assert.deepEqual(picked(weak), ["RULE-LED-002:business-rule-match"]);
});

test("an explicit --domain keeps its whole-domain fallback even when the task names an object", () => {
  const root = project();
  const selected = ids(candidates(root, "Explain RULE-PAY-001", ["--domain", "payments"]));
  assert.deepEqual(selected.filter((id) => id.startsWith("RULE-")).sort(), ["RULE-PAY-001", "RULE-PAY-002"]);
  const other = ids(candidates(root, "Explain RULE-LED-001", ["--domain", "payments"]));
  assert.deepEqual(other.filter((id) => id.startsWith("RULE-")).sort(), ["RULE-LED-001", "RULE-PAY-001", "RULE-PAY-002"]);
});

test("a map cached with the previous term contract is rebuilt, not trusted", () => {
  const root = project();
  const stale = buildKnowledgeMap(root);
  stale.contractVersion = 2; // the contract before rule terms excluded metadata
  writeKnowledgeMap(root, stale);
  assert.equal(loadKnowledgeMap(root).status, "rebuilt-stale");
  assert.ok(fs.existsSync(getKnowledgeMapPath(root)));
});

test("the same task and project state give identical candidates, reasons and order", () => {
  const root = project();
  const first = candidates(root, "Review the journal posting rules");
  const second = candidates(root, "Review the journal posting rules");
  assert.deepEqual(first, second);
});
