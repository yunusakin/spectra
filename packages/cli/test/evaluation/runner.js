// Runs the evaluation corpus through the real context pipeline (in-process
// buildContextPack) and scores it against the hand-authored labels.
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { buildContextPack, estimateTokensFromFile } from "../../src/lib/context.js";
import { ratio, round, score } from "./metrics.js";
import { buildWorld } from "./worlds.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// Budget levels shrink the room left for optional context. "normal" is the
// role's own budget; the others pad the (required) routing policy file so only
// that fraction of the case's candidate tokens fits — an existing test hook, not
// a public budget API.
const LEVEL_ROOM = { tight: 0.5, "very-tight": 0.2 };

const loadCorpus = () => YAML.parse(fs.readFileSync(path.join(here, "corpus.yaml"), "utf8"));
const sum = (list, pick = (value) => value) => list.reduce((total, value) => total + pick(value), 0);
const isRoutingIndex = (entry) => entry.source === "route" && /index$/.test(entry.reason) && entry.reason !== "routing policy";

function observe(world, entry, role, goal) {
  for (const file of entry.changedFiles ?? []) fs.appendFileSync(path.join(world.root, file), "\n");
  const start = performance.now();
  const pack = buildContextPack({
    cwd: world.root,
    role,
    goal,
    routeTask: entry.task,
    domains: [],
    modules: entry.modules ?? [],
    changed: (entry.changedFiles ?? []).length > 0
  });
  return { pack, ms: performance.now() - start };
}

function summarize(entry, level, { pack, ms }, previous) {
  const resolved = pack.entries.filter((candidate) => candidate.source === "resolved");
  const excludedObjects = pack.selection.excluded.filter((candidate) => candidate.kind !== "routing-index");
  const selected = resolved.map((candidate) => candidate.knowledgeId);
  const candidates = [...selected, ...excludedObjects.map((candidate) => candidate.id)];
  const scored = score(entry.expect, { selected, candidates, excluded: excludedObjects });
  const included = sum(resolved, (candidate) => candidate.estimatedTokens);
  const superseded = sum(pack.selection.superseded, (candidate) => candidate.estimatedTokens);
  const indexTokens = sum(pack.entries.filter(isRoutingIndex), (candidate) => candidate.estimatedTokens);
  const wholeOf = (candidate) => (candidate.path === "repo-index" ? path.join(pack.repoRoot, "cache", "index", "repo-index.json") : path.join(pack.repoRoot, candidate.path));
  const sources = new Map();
  for (const candidate of resolved) {
    const row = sources.get(candidate.path) ?? { source: candidate.path, objects: 0, selectedTokens: 0, wholeTokens: estimateTokensFromFile(wholeOf(candidate)) };
    row.objects += 1;
    row.selectedTokens += candidate.estimatedTokens;
    sources.set(candidate.path, row);
  }
  const exactVsWhole = [...sources.values()].sort((a, b) => (a.source < b.source ? -1 : 1));
  const reasons = Object.fromEntries(resolved.map((candidate) => [candidate.knowledgeId, candidate.reasons.map(({ reason, via }) => ({ reason, via }))]));
  const run = {
    case: entry.id,
    level,
    selected,
    candidates,
    excluded: excludedObjects.map((candidate) => ({ id: candidate.id, exclusion: candidate.exclusion })),
    reasons,
    required: pack.selection.included.filter((candidate) => candidate.required && selected.includes(candidate.id)).map((candidate) => candidate.id),
    labels: Object.fromEntries(candidates.map((id) => [id, scored.labelOf(id)])),
    falsePositives: scored.falsePositives,
    falseNegatives: scored.falseNegatives,
    metrics: scored.metrics,
    tokens: {
      candidate: included + sum(excludedObjects, (candidate) => candidate.estimatedTokens),
      included,
      excluded: sum(excludedObjects, (candidate) => candidate.estimatedTokens),
      total: pack.totals.estimatedTokens,
      routingIndexes: indexTokens,
      superseded,
      // Model of the pre-addressability behaviour: policy + routing + whole matched rule files.
      wholeFileBaseline: pack.totals.estimatedTokens - included + superseded
    },
    exactVsWhole,
    selection: {
      status: pack.selection.status,
      knowledge: pack.knowledge.map,
      full: pack.selection.full,
      summary: pack.selection.summary,
      remaining: pack.selection.full.remaining,
      utilization: round(pack.selection.full.used / pack.selection.full.budget),
      warnings: pack.selection.warnings.map((warning) => warning.code)
    }
  };
  if (entry.fallback) {
    const exact = previous.get(entry.compareTo);
    run.fallback = {
      wholeFileTokens: sum(pack.entries.filter((candidate) => candidate.source === "route" && candidate.reason.startsWith("domain: ")), (candidate) => candidate.estimatedTokens),
      exactTokens: exact ? sum(exact.selected.filter((id) => id.startsWith("RULE-")), (id) => exact.objectTokens[id]) : null,
      compareTo: entry.compareTo
    };
  }
  run.objectTokens = Object.fromEntries(resolved.map((candidate) => [candidate.knowledgeId, candidate.estimatedTokens]));
  return { run, ms };
}

function runCorpus(corpus = loadCorpus()) {
  const worlds = new Map();
  const runs = [];
  const perf = { coldMs: {}, resolveMs: [] };
  const normalByCase = new Map();
  try {
    for (const entry of corpus.cases) {
      if (!worlds.has(entry.world)) {
        const world = buildWorld(entry.world);
        // Cold Knowledge Map build is measured on the first resolution of a world.
        fs.rmSync(path.join(world.cacheDir, "knowledge"), { recursive: true, force: true });
        worlds.set(entry.world, world);
      }
      const world = worlds.get(entry.world);
      const role = entry.role ?? "implementer";
      const goal = entry.goal ?? "implement";
      const levels = entry.budgets ?? ["normal"];
      for (const level of levels) {
        let normal = normalByCase.get(entry.id);
        if (level !== "normal") {
          const base = normal.pack.totals.full - normal.run.tokens.included - normal.run.tokens.routingIndexes;
          const room = Math.floor(LEVEL_ROOM[level] * normal.run.tokens.candidate);
          const padTokens = normal.pack.selection.full.budget - base - room;
          if (padTokens > 0) fs.appendFileSync(world.minimal, `\n${"x".repeat(padTokens * 4)}\n`);
        }
        const observed = observe(world, entry, role, goal);
        const { run, ms } = summarize(entry, level, observed, normalByCase.get("__runs") ?? new Map());
        world.reset();
        runs.push(run);
        if (!(entry.world in perf.coldMs)) perf.coldMs[entry.world] = Math.round(ms);
        else perf.resolveMs.push(Math.round(ms));
        if (level === "normal") {
          normalByCase.set(entry.id, { run, pack: observed.pack });
          const lookup = normalByCase.get("__runs") ?? new Map();
          lookup.set(entry.id, run);
          normalByCase.set("__runs", lookup);
        }
      }
    }
  } finally {
    for (const world of worlds.values()) world.cleanup();
  }
  return { corpus, runs, perf, summary: aggregate(corpus, runs) };
}

function aggregate(corpus, runs) {
  const caseOf = (run) => corpus.cases.find((entry) => entry.id === run.case);
  const normal = runs.filter((run) => run.level === "normal" && !caseOf(run).fallback);
  const count = (predicate) => normal.filter(predicate).length;
  const required = sum(normal, (run) => caseOf(run).expect.required?.length ?? 0);
  const relevant = sum(normal, (run) => caseOf(run).expect.relevant?.length ?? 0);
  const selectedRequired = sum(normal, (run) => run.selected.filter((id) => run.labels[id] === "required").length);
  const selectedRelevant = sum(normal, (run) => run.selected.filter((id) => run.labels[id] === "relevant").length);
  const evaluated = sum(normal, (run) => run.selected.filter((id) => run.labels[id] !== "acceptable").length);
  const reasonRows = {};
  for (const run of normal) {
    for (const id of run.selected) {
      if (run.labels[id] === "acceptable") continue;
      const good = ["required", "relevant"].includes(run.labels[id]);
      for (const reason of new Set(run.reasons[id].map((entry) => entry.reason))) {
        const row = (reasonRows[reason] ??= { selected: 0, relevant: 0, falsePositives: 0, tokens: 0 });
        row.selected += 1;
        row.relevant += good ? 1 : 0;
        row.falsePositives += good ? 0 : 1;
        row.tokens += run.objectTokens[id];
      }
    }
  }
  const relationshipOnly = {};
  for (const run of normal) {
    for (const id of run.selected) {
      const set = new Set(run.reasons[id].map((entry) => entry.reason));
      if (run.labels[id] === "acceptable" || ![...set].every((reason) => reason === "feature-relationship" || reason === "repo-index-evidence")) continue;
      const kind = set.has("feature-relationship") ? "feature-relationship" : "repo-index-evidence";
      const row = (relationshipOnly[kind] ??= { selected: 0, relevant: 0, tokens: 0 });
      row.selected += 1;
      row.relevant += ["required", "relevant"].includes(run.labels[id]) ? 1 : 0;
      row.tokens += run.objectTokens[id];
    }
  }
  const objects = sum(normal, (run) => run.tokens.included);
  const whole = sum(normal, (run) => sum(run.exactVsWhole, (row) => row.wholeTokens));
  const selectedWhole = sum(normal, (run) => sum(run.exactVsWhole, (row) => row.selectedTokens));
  const kindOf = (source) => (source === "repo-index" ? "repoIndex" : /(rules|unresolved)\.md$/.test(source) ? "business" : "feature");
  const byKind = {};
  for (const run of normal) {
    for (const row of run.exactVsWhole) {
      const kind = (byKind[kindOf(row.source)] ??= { selectedTokens: 0, wholeTokens: 0 });
      kind.selectedTokens += row.selectedTokens;
      kind.wholeTokens += row.wholeTokens;
    }
  }
  for (const kind of Object.values(byKind)) kind.reduction = ratio(kind.wholeTokens - kind.selectedTokens, kind.wholeTokens);
  const baseline = sum(normal, (run) => run.tokens.wholeFileBaseline);
  const total = sum(normal, (run) => run.tokens.total);
  const missByCause = {};
  for (const run of runs.filter((candidate) => !caseOf(candidate).fallback)) {
    for (const miss of run.falseNegatives) missByCause[`${run.level}:${miss.cause}`] = (missByCause[`${run.level}:${miss.cause}`] ?? 0) + 1;
  }
  return {
    cases: corpus.cases.length,
    runs: runs.length,
    normalRuns: normal.length,
    requiredRecall: ratio(selectedRequired, required),
    relevantRecall: ratio(selectedRelevant, relevant),
    precision: ratio(evaluated - sum(normal, (run) => run.falsePositives.length), evaluated),
    falsePositives: sum(normal, (run) => run.falsePositives.length),
    falsePositivesLabeledIrrelevant: sum(normal, (run) => run.falsePositives.filter((entry) => entry.label === "irrelevant").length),
    falsePositivesUnlabeled: sum(normal, (run) => run.falsePositives.filter((entry) => entry.label === "unlabeled").length),
    precisionLabeledOnly: ratio(evaluated - sum(normal, (run) => run.falsePositives.length), evaluated - sum(normal, (run) => run.falsePositives.filter((entry) => entry.label === "unlabeled").length)),
    falseNegativesNormal: sum(normal, (run) => run.falseNegatives.length),
    candidateTokens: sum(normal, (run) => run.tokens.candidate),
    selectedObjectTokens: objects,
    packTokens: total,
    wholeFileBaselineTokens: baseline,
    packTokenReduction: ratio(baseline - total, baseline),
    exactObjectTokens: selectedWhole,
    wholeSourceTokens: whole,
    exactTokenReduction: ratio(whole - selectedWhole, whole),
    byKind: Object.fromEntries(Object.entries(byKind).sort(([a], [b]) => (a < b ? -1 : 1))),
    statusCounts: Object.fromEntries(["within-budget", "budget-exhausted", "mandatory-overflow"].map((status) => [status, runs.filter((run) => run.selection.status === status).length])),
    statusCountsNormal: Object.fromEntries(["within-budget", "budget-exhausted", "mandatory-overflow"].map((status) => [status, count((run) => run.selection.status === status)])),
    reasons: Object.fromEntries(Object.entries(reasonRows).sort(([a], [b]) => (a < b ? -1 : 1))),
    relationshipOnly,
    missByCause: Object.fromEntries(Object.entries(missByCause).sort(([a], [b]) => (a < b ? -1 : 1)))
  };
}

// Deterministic, path- and time-free view of the results (what baseline.json stores).
function snapshot(results) {
  return {
    summary: results.summary,
    runs: results.runs.map(({ objectTokens, ...run }) => run)
  };
}

export { loadCorpus, runCorpus, snapshot };
