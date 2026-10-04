// Phase 1F.2 — planner/architect decide receive a comment-free projectBrief, not the raw file.
//
// Failure modes enumerated BEFORE implementing the derived brief:
//  - dropping non-functional requirements, security or organizational constraints
//  - dropping product-context prose (the old projectSummary lost all of it)
//  - dropping requirements beyond the first few (projectSummary kept three bullets)
//  - stripping legitimate HTML (inline tags) or fenced code that is real content
//  - stripping a comment-looking string inside a fenced code block
//  - wrong multiline comment handling (comments holding markdown examples, headings or fences)
//  - an unclosed `<!--` swallowing the rest of the brief
//  - a stale derived brief after the canonical brief is edited
//  - raw and derived brief both included (double counting)
//  - the raw canonical brief becoming unreachable
//  - the canonical brief being modified
//  - non-decide roles (implementer, planner/discover, release-manager) changing
//  - overflow hidden by truncation, or a budget increase hiding the defect
//  - candidate/retrieval drift (selection must be identical apart from the brief entry)
//  - a fresh template-heavy brief producing malformed or exploding output
//  - non-deterministic output

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { GOAL_POLICIES, ROLE_POLICIES } from "../src/lib/context/policies.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const briefPath = (root) => path.join(root, ".spectra", "sdd", "memory-bank", "core", "projectbrief.md");

const BRIEF = `# Project Brief

> Maintained project context for Shop.

## Project Name
Shop

## Purpose
Let partners order in bulk.

## App Type
Web service

## Product Context
Shop serves support agents and B2B partners. PROSE-MARKER: partners submit bulk orders through an API instead of email.

<!--
Example:
### Target Users
- COMMENT-EXAMPLE internal customer support agents.
\`\`\`
fence inside a comment
\`\`\`
-->

## Requirements

### Functional Requirements
- FR-ONE order creation.
- FR-TWO order update.
- FR-THREE total with tax.
- FR-FOUR admin order history.
- FR-FIVE partner bulk upload.

### Non-Functional Requirements
- NFR-ONE p95 latency under 300ms.
- NFR-TWO availability 99.9%.

<!--
Example:
### Non-Functional Requirements
- COMMENT-EXAMPLE p95 latency < 300ms for GET /orders.
-->

## Constraints

### Security & Compliance
- SEC-ONE never store raw card data.

### Organizational
- ORG-ONE team knows Java and React.

Keep this literal snippet:

\`\`\`html
<!-- FENCED-COMMENT-KEEP -->
<div>fenced html</div>
\`\`\`

Press <kbd>Ctrl</kbd> to confirm (INLINE-HTML-KEEP).
<!-- trailing authoring note TRAILING-COMMENT -->
`;

function project(brief = BRIEF) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-decide-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true }));
  if (brief !== null) setBrief(root, brief);
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

// Bump mtime so the derived brief is rebuilt even within one filesystem timestamp tick.
function setBrief(root, text) {
  fs.writeFileSync(briefPath(root), text);
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(briefPath(root), future, future);
}

function pack(root, role = "architect", goal = "decide", task = "Choose the storage design") {
  const result = run(root, ["context", "--role", role, "--goal", goal, "--route-task", task, "--format", "json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
const entry = (result, id) => result.entries.find((candidate) => candidate.id === id);
const derived = (result) => fs.readFileSync(entry(result, "projectBriefClean").absolutePath, "utf8");
const DECIDE = [["planner", "decide"], ["architect", "decide"]];

test("decide roles get the derived brief by default, never both forms", () => {
  const root = project();
  for (const [role, goal] of DECIDE) {
    const result = pack(root, role, goal);
    assert.ok(entry(result, "projectBriefClean"), `${role} gets projectBriefClean`);
    assert.equal(entry(result, "projectBrief"), undefined, `${role} must not also get the raw brief`);
  }
});

test("all decide-critical content survives verbatim", () => {
  const text = derived(pack(project()));
  for (const marker of ["PROSE-MARKER", "FR-ONE", "FR-FOUR", "FR-FIVE", "NFR-ONE", "NFR-TWO", "SEC-ONE", "ORG-ONE", "## Purpose", "Let partners order in bulk.", "### Security & Compliance", "> Maintained project context for Shop."]) {
    assert.ok(text.includes(marker), `lost: ${marker}`);
  }
});

test("authoring comments and their examples disappear", () => {
  const text = derived(pack(project()));
  for (const noise of ["COMMENT-EXAMPLE", "TRAILING-COMMENT", "fence inside a comment", "Example:"]) {
    assert.equal(text.includes(noise), false, `template noise remains: ${noise}`);
  }
  assert.equal(/\n{3,}/.test(text), false, "no runs of blank lines left behind");
});

test("fenced code and inline HTML are real content and stay", () => {
  const text = derived(pack(project()));
  assert.ok(text.includes("<!-- FENCED-COMMENT-KEEP -->"), "comment-looking text inside a fence is literal");
  assert.ok(text.includes("<div>fenced html</div>"));
  assert.ok(text.includes("<kbd>Ctrl</kbd>"));
  assert.ok(text.includes("INLINE-HTML-KEEP"));
});

test("an unclosed comment never swallows the rest of the brief", () => {
  const text = derived(pack(project("# Project Brief\n\n## Purpose\nKEEP-BEFORE\n\n<!-- never closed\n\n## Constraints\nKEEP-AFTER\n")));
  assert.ok(text.includes("KEEP-BEFORE") && text.includes("KEEP-AFTER"));
});

test("the derived brief follows edits to the canonical brief", () => {
  const root = project();
  assert.ok(derived(pack(root)).includes("SEC-ONE"));
  setBrief(root, BRIEF.replace("SEC-ONE never store raw card data.", "SEC-EDITED encrypt everything."));
  const text = derived(pack(root));
  assert.ok(text.includes("SEC-EDITED"));
  assert.equal(text.includes("SEC-ONE"), false);
});

test("the canonical brief is untouched and the raw brief stays reachable", () => {
  const root = project();
  const before = fs.readFileSync(briefPath(root), "utf8");
  const result = pack(root);
  assert.equal(fs.readFileSync(briefPath(root), "utf8"), before);
  assert.ok(GOAL_POLICIES.decide.escalation.includes("projectBrief"));
  assert.ok(result.escalation.some((candidate) => candidate.endsWith("sdd/memory-bank/core/projectbrief.md")));
});

test("on a frozen copy of the real Spectra brief (a fixture, not the live file) the architect fits and the planner stays honest", () => {
  const root = project(fs.readFileSync(path.join(cliRoot, "test", "fixtures", "decide", "projectbrief.md"), "utf8"));
  const raw = Math.ceil(fs.statSync(briefPath(root)).size / 4);
  const architect = pack(root, "architect", "decide");
  const planner = pack(root, "planner", "decide");
  const cleanTokens = entry(architect, "projectBriefClean").estimatedTokens;
  assert.ok(cleanTokens < raw * 0.75, `derived ${cleanTokens} vs raw ${raw}`);
  assert.notEqual(architect.selection.status, "mandatory-overflow", "architect fits its unchanged budget");
  assert.equal(architect.selection.mandatory.full, 375 + cleanTokens + entry(architect, "invariants").estimatedTokens);
  assert.equal(planner.selection.mandatory.full, 375 + cleanTokens, "derived brief charged to the markdown pool once");
  assert.equal(planner.selection.status === "mandatory-overflow", planner.selection.mandatory.full > planner.selection.full.budget, "overflow reported, never hidden");
});

test("budgets are unchanged unless a measured decision says otherwise", () => {
  assert.equal(ROLE_POLICIES.architect.budgets.markdownTokens, 1000);
  assert.equal(ROLE_POLICIES.architect.budgets.summaryTokens, 3200);
});

test("a fresh template brief yields valid, small decide context", () => {
  const root = project(null);
  const result = pack(root, "architect", "decide");
  const text = derived(result);
  assert.ok(text.includes("## Purpose") && text.includes("## Constraints"));
  assert.equal(text.includes("<!--"), false);
  assert.ok(entry(result, "projectBriefClean").estimatedTokens < 150);
  assert.notEqual(result.selection.status, "mandatory-overflow");
  assert.equal(entry(result, "projectBrief"), undefined, "dynamic fallback must not re-add the raw brief");
});

test("other roles and goals are unchanged", () => {
  const root = project();
  for (const [role, goal] of [["planner", "discover"], ["implementer", "implement"], ["reviewer", "verify"], ["verifier", "verify"], ["release-manager", "ship"]]) {
    const result = pack(root, role, goal);
    assert.equal(entry(result, "projectBriefClean"), undefined, `${role}/${goal} must not get the derived brief`);
  }
  const implementer = pack(root, "implementer", "implement");
  assert.equal(entry(implementer, "projectBrief"), undefined);
  assert.ok(implementer.selection.full.remaining > 500);
  assert.equal(pack(root, "release-manager", "ship").selection.mandatory.full, 375);
});

test("a deleted brief is not served from the cache and is reported missing", () => {
  const root = project();
  assert.ok(derived(pack(root)).includes("SEC-ONE"));
  fs.rmSync(briefPath(root));
  const result = pack(root);
  assert.equal(entry(result, "projectBriefClean").exists, false);
  assert.equal(fs.existsSync(entry(result, "projectBriefClean").absolutePath), false, "stale derived file removed");
  const inline = run(root, ["context", "--role", "architect", "--goal", "decide", "--format", "inline"]);
  // Other (JSON) summaries are out of scope here; the derived brief block itself must be gone.
  assert.equal(inline.stdout.includes("--- .spectra/cache/context/projectbrief.decide.md"), false);
  assert.ok(`${inline.stdout}${inline.stderr}`.includes("projectbrief.decide.md is missing"));
});

test("a project that never had a brief gets no empty derived entry", () => {
  const root = project(null);
  fs.rmSync(briefPath(root));
  assert.equal(entry(pack(root), "projectBriefClean").exists, false);
});

test("an avoid list naming the raw brief does not contradict the derived copy it receives", () => {
  const result = pack(project(), "implementer", "decide");
  assert.ok(entry(result, "projectBriefClean"));
  assert.equal(result.avoid.includes("sdd/memory-bank/core/projectbrief.md"), false);
});

test("repeated runs are identical, including the derived brief", () => {
  const root = project();
  const runs = [1, 2, 3].map(() => {
    const result = pack(root);
    return JSON.stringify({ selection: result.selection, brief: derived(result) });
  });
  assert.equal(new Set(runs).size, 1);
});
