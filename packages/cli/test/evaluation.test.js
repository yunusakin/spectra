// Phase 1C — retrieval evaluation guardrails.
//
// Failure modes enumerated BEFORE the harness was written:
//
// Harness validity
//  - labels generated from the resolver (circular); a selected object with no
//    label silently ignored; empty denominators reported as 1 or NaN
//  - candidate and selection quality conflated (a budget exclusion counted as a
//    retrieval miss); a knowledge gap counted as a retrieval failure
//  - padding used to simulate a budget leaks into the next case; the world's
//    canonical files change during evaluation
//  - results depend on wall-clock time, tmp paths or filesystem order
// Guardrails
//  - required recall below 100% at any budget level; an explicit reference missed
//  - an unrelated task selecting domain knowledge; the approval-gating dogfood
//    drifting from FR-2/AC-2 + packages/cli
//  - a mandatory-overflow case dropping or truncating required context
// Artifact
//  - baseline.json / REPORT.md stale after a retrieval change (regenerate with
//    `UPDATE_EVALUATION=1 node --test test/evaluation.test.js`)

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadCorpus, runCorpus, snapshot } from "./evaluation/runner.js";
import { renderReport } from "./evaluation/report.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "evaluation");
const baselinePath = path.join(dir, "baseline.json");
const reportPath = path.join(dir, "REPORT.md");

const corpus = loadCorpus();
const results = runCorpus(corpus);
const byId = (id, level = "normal") => results.runs.find((run) => run.case === id && run.level === level);

test("corpus: labelled by hand, disjoint, typed gaps, covers the required scenarios", () => {
  const ids = corpus.cases.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(corpus.cases.length >= 12 && corpus.cases.length <= 20, `${corpus.cases.length} cases`);
  for (const entry of corpus.cases) {
    const { required = [], relevant = [], acceptable = [], irrelevant = [] } = entry.expect;
    const all = [...required, ...relevant, ...acceptable, ...irrelevant];
    assert.equal(new Set(all).size, all.length, `${entry.id}: a knowledge ID has two labels`);
    if (!entry.expect.none) assert.ok(all.length > 0, `${entry.id}: no labels`);
    for (const gap of entry.gaps ?? []) assert.match(gap.type, /^missing (business rule|requirement|module relationship|test relationship|domain mapping)$/);
  }
  const categories = new Set(corpus.cases.map((entry) => entry.category));
  for (const needed of ["explicit-reference", "business-rule-lexical", "business-domain-fallback", "feature-lexical", "changed-file", "explicit-module", "rule-module-evidence", "unrelated", "mandatory-overflow", "fallback", "dogfood"]) {
    assert.ok(categories.has(needed), needed);
  }
  assert.ok(corpus.cases.filter((entry) => entry.world === "spectra").length >= 3);
  assert.ok(corpus.cases.some((entry) => (entry.budgets ?? []).includes("tight")));
});

test("required recall is 100% for every case at every budget level", () => {
  const missed = results.runs.filter((run) => run.metrics.requiredRecall !== null && run.metrics.requiredRecall < 1);
  assert.deepEqual(missed.map((run) => `${run.case}@${run.level}`), []);
});

test("explicit semantic references are always selected, even above budget", () => {
  for (const id of ["explicit-rule", "explicit-fr", "explicit-ac", "mandatory-overflow"]) {
    const run = byId(id);
    const required = corpus.cases.find((entry) => entry.id === id).expect.required;
    for (const knowledgeId of required) assert.ok(run.selected.includes(knowledgeId), `${id}: ${knowledgeId}`);
  }
  const overflow = byId("mandatory-overflow");
  assert.equal(overflow.selection.status, "mandatory-overflow");
  assert.ok(overflow.selection.remaining < 0);
});

test("regression-tier cases: no false positives, no retrieval misses at the normal budget", () => {
  for (const entry of corpus.cases.filter((candidate) => candidate.tier === "regression")) {
    const { metrics, falsePositives, falseNegatives } = byId(entry.id);
    assert.deepEqual(falsePositives, [], `${entry.id} false positives`);
    // a relevant object may only be missing because selection dropped it for budget
    assert.deepEqual(falseNegatives.filter((miss) => miss.cause === "retrieval-miss").map((miss) => miss.id), [], `${entry.id} retrieval misses`);
    assert.ok(metrics.requiredRecall === null || metrics.requiredRecall === 1);
  }
});

test("an unrelated task selects no domain knowledge", () => {
  const run = byId("unrelated");
  assert.deepEqual(run.selected, []);
  assert.deepEqual(run.candidates, []);
});

test("budget pressure only costs optional recall, never required recall", () => {
  for (const id of ["rule-lexical", "spectra-approval-gating"]) {
    const levels = ["normal", "tight", "very-tight"].map((level) => byId(id, level));
    assert.ok(levels.every(Boolean));
    assert.ok(levels[2].tokens.included <= levels[0].tokens.included);
    assert.ok(levels[1].tokens.included <= levels[0].tokens.included);
  }
  const tight = byId("rule-lexical", "very-tight");
  assert.ok(tight.excluded.length > 0, "very tight budget excludes optional candidates");
  assert.ok(tight.falseNegatives.every((miss) => miss.cause !== "retrieval-miss"), "budget misses are not retrieval failures");
});

test("fallback keeps whole files and is quantified against exact resolution", () => {
  const run = byId("fallback-whole-file");
  assert.equal(run.selection.knowledge, "unavailable");
  assert.ok(run.fallback.wholeFileTokens > run.fallback.exactTokens);
});

test("baseline.json and REPORT.md are the checked-in measurement of current retrieval", () => {
  const snap = snapshot(results);
  const report = renderReport(results, corpus);
  if (process.env.UPDATE_EVALUATION === "1") {
    fs.writeFileSync(baselinePath, `${JSON.stringify(snap, null, 2)}\n`);
    fs.writeFileSync(reportPath, report);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(baselinePath, "utf8")), JSON.parse(JSON.stringify(snap)));
  assert.equal(fs.readFileSync(reportPath, "utf8"), report);
});
