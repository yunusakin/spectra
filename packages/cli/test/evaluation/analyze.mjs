#!/usr/bin/env node
// Phase 1E root-cause analysis over the evaluation corpus (read-only: it never
// changes retrieval, labels or the checked-in baseline).
//
//   node test/evaluation/analyze.mjs            markdown to stdout
//   node test/evaluation/analyze.mjs --json     machine-readable
//
// For every false positive it prints the reason, the matching terms and the
// domain/module signals that were present; for every false negative it says
// whether the object ever became a candidate (retrieval) or was dropped by
// selection (budget/anchor). It also tabulates, per lexical term, how often a
// `business-rule-match` on that term was relevant, using the actual corpus.
import fs from "node:fs";
import path from "node:path";
import { buildContextPack } from "../../src/lib/context.js";
import { loadKnowledgeMap } from "../../src/lib/knowledge/map.js";
import { termsOf } from "../../src/lib/knowledge/terms.js";
import { score } from "./metrics.js";
import { loadCorpus } from "./runner.js";
import { buildWorld } from "./worlds.js";

const GOOD = new Set(["required", "relevant"]);

function observeCase(world, entry) {
  for (const file of entry.changedFiles ?? []) fs.appendFileSync(path.join(world.root, file), "\n");
  const pack = buildContextPack({
    cwd: world.root,
    role: entry.role ?? "implementer",
    goal: entry.goal ?? "implement",
    routeTask: entry.task,
    domains: [],
    modules: entry.modules ?? [],
    changed: (entry.changedFiles ?? []).length > 0
  });
  const map = loadKnowledgeMap(world.root).map;
  world.reset();
  return { pack, map };
}

// How many of the rules in the candidate's own domain (same business/<domain>/
// directory) contain each term; `N` is the domain's rule count.
function domainFrequencyOf(map, id) {
  const rule = map.references.find((reference) => reference.id === id && reference.kind === "business-rule");
  if (!rule) return null;
  const siblings = map.references.filter((reference) => reference.kind === "business-rule" && path.dirname(reference.source) === path.dirname(rule.source));
  const counts = {};
  for (const term of rule.terms ?? []) counts[term] = siblings.filter((sibling) => (sibling.terms ?? []).includes(term)).length;
  return { rules: siblings.length, counts };
}

function analyzeCase(entry, { pack, map }) {
  const resolved = pack.entries.filter((candidate) => candidate.source === "resolved");
  const excluded = pack.selection.excluded.filter((candidate) => candidate.kind !== "routing-index");
  const selected = resolved.map((candidate) => candidate.knowledgeId);
  const candidates = [...selected, ...excluded.map((candidate) => candidate.id)];
  const scored = score(entry.expect, { selected, candidates, excluded });
  const reasonsOf = new Map([...resolved.map((candidate) => [candidate.knowledgeId, candidate.reasons]), ...excluded.map((candidate) => [candidate.id, candidate.reasons])]);
  const rows = candidates.map((id) => ({
    id,
    label: scored.labelOf(id),
    selected: selected.includes(id),
    exclusion: excluded.find((candidate) => candidate.id === id)?.exclusion ?? null,
    reasons: reasonsOf.get(id).map(({ reason, via }) => ({ reason, via })),
    domainFrequency: domainFrequencyOf(map, id)
  }));
  const taskTerms = termsOf(entry.task);
  return {
    case: entry.id,
    task: entry.task,
    taskTerms,
    domainSignals: pack.route.domainMatches.map(({ name, matchedBy, matchedValue }) => ({ name, matchedBy, matchedValue })),
    moduleSignals: pack.route.moduleMatches.map(({ name, matchedBy }) => ({ name, matchedBy })),
    explicitModules: entry.modules ?? [],
    rows,
    falsePositives: rows.filter((row) => row.selected && row.label !== "acceptable" && !GOOD.has(row.label)),
    falseNegatives: scored.falseNegatives.map((miss) => ({ ...miss, discovered: candidates.includes(miss.id) })),
    knowledge: { rules: map.references.filter((reference) => reference.kind === "business-rule").length }
  };
}

// term -> { matches, relevant, falsePositives }, over every business-rule-match
// candidate (selected or budget-excluded: lexical quality is independent of budget).
function termEvidence(cases) {
  const table = new Map();
  for (const analysis of cases) {
    for (const row of analysis.rows) {
      if (row.label === "acceptable") continue;
      for (const { reason, via } of row.reasons) {
        if (reason !== "business-rule-match") continue;
        for (const term of via.split(",")) {
          const cell = table.get(term) ?? { term, matches: 0, relevant: 0, falsePositives: 0, domainFrequency: new Set() };
          cell.matches += 1;
          if (row.domainFrequency) cell.domainFrequency.add(`${row.domainFrequency.counts[term]}/${row.domainFrequency.rules}`);
          cell[GOOD.has(row.label) ? "relevant" : "falsePositives"] += 1;
          table.set(term, cell);
        }
      }
    }
  }
  return [...table.values()].map((cell) => ({ ...cell, domainFrequency: [...cell.domainFrequency].sort().join(" ") })).sort((a, b) => b.matches - a.matches || (a.term < b.term ? -1 : 1));
}

function render(report) {
  const out = [];
  out.push("# Phase 1E root-cause analysis (generated, read-only)", "");
  for (const analysis of report.cases) {
    out.push(`## \`${analysis.case}\` — ${analysis.task}`, "");
    out.push(`- task terms: ${analysis.taskTerms.join(", ") || "–"}`);
    out.push(`- domain signals: ${analysis.domainSignals.map((signal) => `${signal.name} (${signal.matchedBy}:${signal.matchedValue})`).join("; ") || "none"}`);
    out.push(`- module signals: ${analysis.moduleSignals.map((signal) => `${signal.name} (${signal.matchedBy})`).join("; ") || "none"}${analysis.explicitModules.length ? ` [--module ${analysis.explicitModules.join(",")}]` : ""}`);
    for (const row of analysis.falsePositives) {
      out.push(`- FALSE POSITIVE \`${row.id}\` [${row.label}] reasons: ${row.reasons.map(({ reason, via }) => `${reason}(${via})`).join(", ")}`);
    }
    for (const miss of analysis.falseNegatives) {
      out.push(`- FALSE NEGATIVE \`${miss.id}\` [${miss.label}] discovered=${miss.discovered} cause=${miss.cause}`);
    }
    if (analysis.falsePositives.length + analysis.falseNegatives.length === 0) out.push("- no false positives or negatives");
    out.push("");
  }
  out.push("## Term-level evidence — `business-rule-match` (all candidates, acceptable labels excluded)", "");
  out.push("| Term | Rule matches | Relevant | False positives | Precision | Domain-local df |", "| --- | --- | --- | --- | --- | --- |");
  for (const row of report.terms) {
    const pct = row.matches === 0 ? "n/a" : `${((row.relevant / row.matches) * 100).toFixed(1)}%`;
    out.push(`| ${row.term} | ${row.matches} | ${row.relevant} | ${row.falsePositives} | ${pct} | ${row.domainFrequency || "–"} |`);
  }
  out.push("", "Domain-local df is `rules containing the term / rules in the candidate's domain`, per matched candidate (several values when worlds differ).", "");
  return `${out.join("\n")}\n`;
}

function main() {
  const corpus = loadCorpus();
  const worlds = new Map();
  const cases = [];
  try {
    for (const entry of corpus.cases.filter((candidate) => !candidate.fallback)) {
      if (!worlds.has(entry.world)) worlds.set(entry.world, buildWorld(entry.world));
      const observed = observeCase(worlds.get(entry.world), entry);
      cases.push(analyzeCase(entry, observed));
    }
  } finally {
    for (const world of worlds.values()) world.cleanup();
  }
  const report = { cases, terms: termEvidence(cases) };
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : render(report));
}

main();
