// Phase 1F.1 — release-manager/ship must not carry the whole release history as mandatory markdown.
//
// Failure modes enumerated BEFORE implementing the compact release representation:
//  - dropping release-critical information (the section being shipped: highlights, risks, migration, rollback)
//  - summarizing the wrong release (oldest-first files, a stale "latest", an empty Unreleased section)
//  - historical/current ambiguity (old release text leaking into, or replacing, the current section)
//  - the summary going stale after RELEASE_SUMMARY.md is edited
//  - incorrect pool accounting (summary charged to markdownTokens, or the reverse; both sources included)
//  - full source and summary both injected (double counting)
//  - a fresh project with no release file crashing or paying markdown tokens
//  - mandatory overflow being hidden (an oversized current section truncated to fit)
//  - non-deterministic output (timestamps, ordering)
//  - planner/architect decide or implementer policy changing as a side effect
//  - a budget increase hiding the defect (budgets asserted unchanged)
//  - the context still scaling with the whole history (bounded-context property)

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { GOAL_POLICIES, ROLE_POLICIES } from "../src/lib/context/policies.js";
import { withAbsolute } from "./helpers/context-pack.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const releaseFile = (root) => path.join(root, ".spectra", "RELEASE_SUMMARY.md");

function project(releaseText = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-release-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true }));
  if (releaseText !== null) setRelease(root, releaseText);
  assert.equal(run(root, ["index"]).status, 0);
  return root;
}

// Bump mtime so the derived summary is rebuilt even within one filesystem timestamp tick.
function setRelease(root, text) {
  fs.writeFileSync(releaseFile(root), text);
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(releaseFile(root), future, future);
}

const CURRENT = "## Unreleased\n\nAdds bulk ordering. RISK: orders table migration is irreversible after step 2. ROLLBACK: restore the pre-release snapshot.\n\n- Migration: run `shop migrate` before deploy.\n- Blocking: payment webhook v2 must be live first.\n";

function history(count, { oldestFirst = false } = {}) {
  const sections = Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return `## v1.${n}.0\n\nANCIENT-${n} narrative about release ${n}. ${"It improves ordering throughput and fixes edge cases for partners. ".repeat(4)}\n\n- change ${n}a\n- change ${n}b\n`;
  });
  return oldestFirst ? sections : sections.reverse();
}

const release = (current, count, options) => `# Release Summary\n\n${current}\n${history(count, options).join("\n")}`;

function ship(root, task = "Prepare the release for shipping") {
  const result = run(root, ["context", "--role", "release-manager", "--goal", "ship", "--route-task", task, "--format", "json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return withAbsolute(root, JSON.parse(result.stdout));
}
const entry = (pack, id) => pack.entries.find((candidate) => candidate.id === id);
const cachedRelease = (pack) => fs.readFileSync(entry(pack, "releaseSummary").absolutePath, "utf8");

test("release-manager/ship receives the current release as a summary entry, not the whole file", () => {
  const root = project(release(CURRENT, 30));
  const pack = ship(root);
  assert.equal(entry(pack, "releaseSummary").mode, "summary");
  assert.equal(pack.entries.some((candidate) => candidate.path === "RELEASE_SUMMARY.md"), false, "full file not injected");
  assert.equal(entry(pack, "releaseHistory"), undefined, "history is escalation only");
});

test("the section being shipped is preserved verbatim, history text is not", () => {
  const root = project(release(CURRENT, 30));
  const text = cachedRelease(ship(root));
  for (const needle of ["orders table migration is irreversible", "restore the pre-release snapshot", "shop migrate", "payment webhook v2"]) {
    assert.ok(text.includes(needle), `missing release-critical text: ${needle}`);
  }
  assert.equal(text.includes("ANCIENT-"), false, "historical narrative is not mandatory context");
});

test("mandatory context stays bounded while the release history grows", () => {
  const small = ship(project(release(CURRENT, 3)));
  const large = ship(project(release(CURRENT, 60)));
  assert.equal(large.selection.mandatory.full, small.selection.mandatory.full, "markdown pool independent of history");
  const growth = large.selection.mandatory.summary - small.selection.mandatory.summary;
  assert.ok(growth <= 8, `summary pool grew by ${growth} tokens for 57 more releases`);
  assert.equal(large.selection.status === "mandatory-overflow", false);
});

test("the current section is the Unreleased one regardless of file order", () => {
  const newestLast = `# Release Summary\n\n${history(5, { oldestFirst: true }).join("\n")}\n${CURRENT}`;
  const text = cachedRelease(ship(project(newestLast)));
  assert.ok(text.includes("orders table migration is irreversible"));
  assert.equal(text.includes("ANCIENT-"), false);
});

test("without Unreleased the highest version is current, not the first section", () => {
  const oldestFirst = `# Release Summary\n\n${history(5, { oldestFirst: true }).join("\n")}`;
  const text = cachedRelease(ship(project(oldestFirst)));
  assert.ok(text.includes("ANCIENT-5"), "highest semver (v1.5.0) is current");
  assert.equal(text.includes("ANCIENT-1 "), false);
});

test("an empty Unreleased section falls back to the latest release", () => {
  const empty = `# Release Summary\n\n## Unreleased\n\n${history(3).join("\n")}`;
  const text = cachedRelease(ship(project(empty)));
  assert.ok(text.includes("ANCIENT-3"));
});

test("Keep-a-Changelog headings: [Unreleased] is current even when listed after an older release", () => {
  const text = cachedRelease(ship(project("# Changelog\n\n## [1.0.0] - 2026-01-01\n\nOLD-SHIPPED\n\n## [Unreleased]\n\nNEW-PENDING\n")));
  assert.ok(text.includes("NEW-PENDING"));
  assert.equal(text.includes("OLD-SHIPPED"), false);
});

test("bracketed and dated version headings rank by version, not file order", () => {
  const text = cachedRelease(ship(project("## [1.0.0] - 2026-01-01\n\nV1\n\n## [1.2.0] - 2026-03-01\n\nV12\n\n## [1.1.0] - 2026-02-01\n\nV11\n")));
  assert.ok(text.includes("V12"));
  assert.equal(text.includes("V11"), false);
});

test("a final release outranks its own pre-release", () => {
  const text = cachedRelease(ship(project("## v1.0.0-rc.1\n\nRC-NOTES\n\n## v1.0.0\n\nFINAL-NOTES\n")));
  assert.ok(text.includes("FINAL-NOTES"));
  assert.equal(text.includes("RC-NOTES"), false);
});

test("a placeholder Unreleased section does not hide the latest release", () => {
  for (const placeholder of ["- None", "<!-- nothing yet -->", "_No changes yet._"]) {
    const text = cachedRelease(ship(project(`## Unreleased\n\n${placeholder}\n\n## v1.0.0\n\nREAL-NOTES\n`)));
    assert.ok(text.includes("REAL-NOTES"), `placeholder ${placeholder}`);
  }
});

test("the summary follows edits to RELEASE_SUMMARY.md", () => {
  const root = project(release(CURRENT, 3));
  assert.ok(cachedRelease(ship(root)).includes("irreversible"));
  setRelease(root, release("## Unreleased\n\nOnly a docs fix. EDITED-MARKER.\n", 3));
  const text = cachedRelease(ship(root));
  assert.ok(text.includes("EDITED-MARKER"));
  assert.equal(text.includes("irreversible"), false);
});

test("a project without a release file stays valid and pays no markdown tokens for it", () => {
  const pack = ship(project());
  assert.equal(pack.selection.status === "mandatory-overflow", false);
  assert.equal(pack.selection.mandatory.full, 375, "only the minimal rules remain in the markdown pool");
  assert.ok(entry(pack, "releaseSummary").estimatedTokens < 40);
});

test("an oversized current section is returned whole and reported as overflow, never truncated", () => {
  const huge = `## Unreleased\n\n${"Detailed ship-critical note that must stay intact. ".repeat(400)}END-OF-CURRENT\n`;
  const pack = ship(project(release(huge, 3)));
  assert.ok(cachedRelease(pack).includes("END-OF-CURRENT"));
  assert.equal(pack.selection.status, "mandatory-overflow");
  assert.ok(pack.selection.warnings.some((warning) => warning.code === "mandatory-overflow"));
});

test("accounting: release summary is charged to the summary pool only", () => {
  const pack = ship(project(release(CURRENT, 10)));
  const included = pack.selection.included.find((candidate) => candidate.id === "releaseSummary");
  assert.ok(included?.required);
  assert.equal(included.estimatedTokens, entry(pack, "releaseSummary").estimatedTokens);
  assert.equal(pack.selection.mandatory.full, 375);
});

test("repeated runs are identical, including the release representation", () => {
  const root = project(release(CURRENT, 12));
  const runs = [1, 2, 3].map(() => {
    const pack = ship(root);
    return JSON.stringify({ selection: pack.selection, release: cachedRelease(pack) });
  });
  assert.equal(new Set(runs).size, 1);
});

test("the full release file stays reachable as an escalation entry", () => {
  assert.ok(GOAL_POLICIES.ship.escalation.includes("releaseHistory"));
  const pack = ship(project(release(CURRENT, 3)));
  assert.ok(pack.escalation.includes("RELEASE_SUMMARY.md"));
});

test("other roles are untouched: decide roles keep the brief content, implementer keeps its summary fallback", () => {
  const root = project(release(CURRENT, 5));
  const pack = (role, goal) => JSON.parse(run(root, ["context", "--role", role, "--goal", goal, "--route-task", "Fix the order endpoint", "--format", "json"]).stdout);
  for (const role of ["planner", "architect"]) {
    assert.ok(pack(role, "decide").entries.some((candidate) => candidate.id === "projectBriefClean"), `${role}/decide keeps the (comment-free) project brief`);
  }
  const implement = pack("implementer", "implement");
  assert.equal(implement.entries.some((candidate) => candidate.id === "projectBrief"), false);
  assert.equal(implement.entries.some((candidate) => candidate.id === "releaseSummary"), false);
});

test("a release with a blocking review finding gets the gate and the release summary together", () => {
  const root = project(release(CURRENT, 20));
  const gate = path.join(root, ".spectra", "sdd", "memory-bank", "core", "review-gate.md");
  fs.writeFileSync(gate, "# Review Gate\n\n## Findings\n\n| Date | Scope | Source | Severity | Status | Owner | Note |\n|---|---|---|---|---|---|---|\n| 2026-10-01 | orders | validation | critical | open | qa | Missing idempotency guard |\n");
  const pack = ship(root);
  const ids = pack.entries.map((candidate) => candidate.id);
  assert.ok(ids.includes("reviewGate"), "blocking finding adds the full review gate");
  assert.ok(ids.includes("releaseSummary"));
  assert.ok(cachedRelease(pack).includes("irreversible"));
  assert.ok(pack.selection.included.filter((candidate) => candidate.required).some((candidate) => candidate.id === "reviewGate"), "gate is mandatory, not optional");
});

test("budgets are unchanged", () => {
  assert.deepEqual(ROLE_POLICIES["release-manager"].budgets, { summaryTokens: 2600, markdownTokens: 700 });
  assert.deepEqual(ROLE_POLICIES.planner.budgets, { summaryTokens: 2600, markdownTokens: 700 });
  assert.deepEqual(ROLE_POLICIES.architect.budgets, { summaryTokens: 3200, markdownTokens: 1000 });
});
