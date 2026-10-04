// Phase 1F — budget policy calibration (candidate generation is frozen; only baseline representation moves).
//
// Failure modes enumerated BEFORE changing policy:
//  - dropping or truncating required role context while making room (mandatory-overflow must stay honest)
//  - a role receives an entry its own `avoid` list names (implementer gets the full project brief)
//  - the full brief is removed with no project orientation left (information deletion, not calibration)
//  - summary-pool and markdown-pool accounting drift (a summary entry charged to markdownTokens, or the reverse)
//  - a filled implementation brief starts behaving like an empty one (or the reverse)
//  - a fresh project regresses while the Spectra repository improves
//  - roles whose goal policy deliberately includes the brief (planner/architect decide) lose it
//  - a budget increase hides the defect instead of fixing it (budgets are asserted unchanged)
//  - the problem merely moves from the markdown pool to the summary pool
//  - candidate IDs or reasons change (retrieval is out of scope)

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ROLE_POLICIES } from "../src/lib/context/policies.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const sdd = (root) => path.join(root, ".spectra", "sdd");
const core = (root, name) => path.join(sdd(root), "memory-bank", "core", name);

function project({ brief = true, filledImplementation = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-budget-policy-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true }));
  if (brief) {
    const narrative = "The platform lets partners submit bulk orders and gives support a single place to view customer activity. ".repeat(30);
    fs.writeFileSync(core(root, "projectbrief.md"), `# Project Brief\n\n## Project Name\nShop\n\n## Purpose\nLet partners order in bulk.\n\n## App Type\nWeb service\n\n## Product Context\n${narrative}\n\n## Requirements\n\n### Functional Requirements\n- Partners submit orders through an API.\n`);
  }
  if (filledImplementation) {
    fs.writeFileSync(core(root, "implementation-brief.md"), "# Implementation Brief\n\n## Item ID\nITEM-1\n\n## Task Type\nfeature\n\n## Goal\nAdd bulk order endpoint\n");
  }
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

function pack(root, role, goal, task = "Fix the order endpoint", extra = []) {
  const result = run(root, ["context", "--role", role, "--goal", goal, "--route-task", task, "--format", "json", ...extra]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
const ids = (result) => result.entries.map((entry) => entry.id ?? entry.path);
const MATRIX = [["planner", "discover"], ["planner", "decide"], ["architect", "decide"], ["implementer", "implement"], ["reviewer", "verify"], ["verifier", "verify"], ["release-manager", "ship"]];

test("no role receives an entry its own avoid list names", () => {
  const root = project();
  for (const [role, goal] of MATRIX) {
    const result = pack(root, role, goal);
    const paths = result.entries.map((entry) => entry.path);
    for (const avoided of ROLE_POLICIES[role].avoid.filter((candidate) => !candidate.includes("*"))) {
      assert.equal(paths.includes(avoided), false, `${role}/${goal} includes avoided ${avoided}`);
    }
  }
});

test("implementer keeps project orientation as summaries, not the full brief", () => {
  const root = project();
  const result = pack(root, "implementer", "implement");
  assert.equal(ids(result).includes("projectBrief"), false);
  assert.ok(ids(result).includes("sharedCore"), "shared core summary carries name/purpose/app type");
  assert.ok(ids(result).includes("projectSummary"), "project summary replaces the full brief");
  assert.ok(result.selection.full.remaining > 500, `headroom ${result.selection.full.remaining}`);
});

test("a filled implementation brief gives the same context as before: no project orientation fallback", () => {
  const root = project({ filledImplementation: true });
  const result = pack(root, "implementer", "implement");
  assert.equal(ids(result).includes("projectBrief"), false);
  assert.equal(ids(result).includes("projectSummary"), false);
});

test("decide roles still get the full brief content (comment-free since Phase 1F.2), and overflow stays honest and untruncated", () => {
  const root = project();
  const result = pack(root, "planner", "decide");
  const brief = result.entries.find((entry) => entry.id === "projectBriefClean");
  assert.ok(brief, "decide keeps the project brief content");
  assert.equal(brief.estimatedTokens, Math.ceil(fs.statSync(brief.absolutePath).size / 4), "whole derived file, not truncated");
  assert.equal(result.selection.status, "mandatory-overflow");
  assert.ok(result.selection.warnings.some((warning) => warning.code === "mandatory-overflow"));
});

test("summary entries are charged to the summary pool and full files to the markdown pool", () => {
  const root = project();
  for (const [role, goal] of MATRIX) {
    const result = pack(root, role, goal);
    const sum = (mode) => result.selection.included.filter((entry) => entry.required).reduce((total, entry) => {
      const source = result.entries.find((candidate) => (candidate.knowledgeId ?? candidate.id ?? candidate.path) === entry.id);
      return total + ((source?.mode === "summary") === (mode === "summary") ? entry.estimatedTokens : 0);
    }, 0);
    assert.equal(result.selection.mandatory.summary, sum("summary"), `${role}/${goal} summary`);
    assert.equal(result.selection.mandatory.full, sum("markdown"), `${role}/${goal} markdown`);
  }
});

test("budgets are unchanged by the calibration", () => {
  const budgets = Object.fromEntries(Object.entries(ROLE_POLICIES).map(([role, policy]) => [role, policy.budgets]));
  assert.deepEqual(budgets, {
    planner: { summaryTokens: 2600, markdownTokens: 700 },
    architect: { summaryTokens: 3200, markdownTokens: 1000 },
    implementer: { summaryTokens: 3200, markdownTokens: 1200 },
    reviewer: { summaryTokens: 3000, markdownTokens: 800 },
    verifier: { summaryTokens: 2800, markdownTokens: 700 },
    "release-manager": { summaryTokens: 2600, markdownTokens: 700 }
  });
});

test("an explicit reference stays mandatory and exact at the implementer budget", () => {
  const root = project();
  const business = path.join(sdd(root), "memory-bank", "business");
  fs.mkdirSync(path.join(business, "orders"), { recursive: true });
  fs.writeFileSync(path.join(business, "INDEX.md"), "# Business Domain Index\n\n| Domain | Keywords | Rules | Unresolved | Related Modules |\n| --- | --- | --- | --- | --- |\n| orders | bulk | business/orders/rules.md | business/orders/unresolved.md | |\n");
  fs.writeFileSync(path.join(business, "orders", "rules.md"), "# Rules\n\n## RULE-ORD-001 \u2014 Bulk limit\n\nBulk orders are capped at one hundred lines.\n\nStatus: active\n");
  fs.writeFileSync(path.join(business, "orders", "unresolved.md"), "# U\n");
  const result = pack(root, "implementer", "implement", "Explain RULE-ORD-001");
  const rule = result.selection.included.find((entry) => entry.id === "RULE-ORD-001");
  assert.ok(rule?.required, "explicit reference is required");
  assert.notEqual(result.selection.status, "mandatory-overflow");
});

test("repeated runs are identical", () => {
  const root = project();
  const runs = [1, 2, 3].map(() => JSON.stringify(pack(root, "implementer", "implement").selection));
  assert.equal(new Set(runs).size, 1);
});
