// Phase 1D — Spectra's own canonical knowledge (sdd/memory-bank/business/spectra-product).
//
// Failure modes enumerated BEFORE writing the rules:
//  - a rule loses its stable ID, is duplicated, or sits in the wrong status file
//  - a rule names a module that modules.md does not define (invented second module system)
//  - a rule is not addressable, so the Knowledge Map and exact-object resolver miss it
//  - the domain keywords stop routing a real lifecycle/governance/cache/budget task to the
//    domain, so its rules are never even candidates
//  - an explicit RULE reference is dropped or truncated instead of returned as mandatory
//  - the canonical knowledge needs a schema/migration change (project check regresses)

import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildKnowledgeMap, lookupKnowledgeReference } from "../src/lib/knowledge/map.js";
import { resolveBusinessRule } from "../src/lib/knowledge/address.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(cliRoot, "..", "..");
const ACTIVE = Array.from({ length: 10 }, (_, n) => `RULE-SPE-${String(n + 1).padStart(3, "0")}`);
const UNRESOLVED = ["RULE-SPE-011"];

const context = (...args) => {
  const run = spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), "context", "--role", "implementer", "--goal", "implement", "--format", "json", ...args], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};

test("every spectra-product rule is addressable with a stable ID, status and a real module", () => {
  const map = buildKnowledgeMap(repoRoot);
  const modules = new Set(["packages-cli", "packages-core", "packages-templates", "scripts"]);
  for (const id of [...ACTIVE, ...UNRESOLVED]) {
    const reference = lookupKnowledgeReference(map, id);
    assert.ok(reference, `${id} is in the Knowledge Map`);
    const section = { raw: resolveBusinessRule(repoRoot, id).text };
    assert.match(section.raw, new RegExp(`^## ${id} — `));
    assert.match(section.raw, new RegExp(`^Status: ${UNRESOLVED.includes(id) ? "unresolved" : "active"}$`, "m"));
    const affected = section.raw.match(/^Affected Modules:\s+(.+)$/m)?.[1].split(",").map((name) => name.trim()) ?? [];
    assert.ok(affected.length > 0 && affected.every((name) => modules.has(name)), `${id} modules ${affected}`);
  }
});

test("real lifecycle, governance, cache and budget tasks route to their canonical rules", () => {
  const cases = [
    ["Change how project migration happens during spectra migrate", "RULE-SPE-001"],
    ["Change implementation approval behavior", "RULE-SPE-006"],
    ["Change Knowledge Map cache behavior", "RULE-SPE-008"],
    ["Change mandatory context handling when the budget overflows", "RULE-SPE-010"]
  ];
  for (const [task, id] of cases) {
    const { selection } = context("--route-task", task);
    const seen = [...selection.included, ...selection.excluded].map((entry) => entry.id);
    assert.ok(seen.includes(id), `${task} -> ${id} (saw ${seen.filter((entry) => entry.startsWith("RULE-"))})`);
  }
});

test("an explicit rule reference is mandatory and returned exactly", () => {
  const { selection } = context("--route-task", "Change implementation approval behavior RULE-SPE-006");
  const entry = selection.included.find((candidate) => candidate.id === "RULE-SPE-006");
  assert.ok(entry?.required, "explicit RULE-SPE-006 is included as required");
});
