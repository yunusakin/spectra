import fs from "node:fs";
import path from "node:path";
import { ensureDirectory, findSpectraRoot } from "../runtime.js";
import { readIndex as readRepoIndex } from "../index/cache.js";
import { getChangedFiles as collectChangedFiles } from "../git-diff.js";
import { buildRoute } from "../business-context.js";
import { ENTRY_DEFS } from "./sources.js";
import { resolveKnowledgeEntries } from "./knowledge.js";
import { poolOf, selectContext } from "./selection.js";
import { GOAL_POLICIES, ROLE_POLICIES, normalizeGoal, normalizeRole, resolveTask } from "./policies.js";
import { getCacheDir, getContextRoot } from "./roots.js";
import { ensureContextSummaries } from "./summaries.js";

function readSummary(repoRoot, fileName) {
  const absolutePath = path.join(getCacheDir(repoRoot), fileName);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function getChangedFiles(repoRoot, { changed = false, base = null, head = null } = {}) {
  if (base) {
    return collectChangedFiles(repoRoot, { base, head, includeWorktree: false, sort: false });
  }
  if (!changed) {
    return [];
  }
  return collectChangedFiles(repoRoot, { includeWorktree: true, sort: false });
}

function uniqueEntries(values) {
  const seen = new Set();
  const ordered = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }

  return ordered;
}

function chooseDynamicEntries(goal, summaries) {
  const entries = [];

  if (goal === "verify" || goal === "ship") {
    if (summaries.review?.findings?.blocking) {
      entries.push("reviewGate");
    }
    if ((summaries.progress?.counts?.blocked ?? 0) > 0) {
      entries.push("progress");
    }
  }

  if (goal === "implement") {
    const implementation = summaries.implementation ?? {};
    const project = summaries.project ?? {};
    if ((!implementation.itemId || !implementation.goal) && (project.purpose || project.appType || project.projectName)) {
      entries.push("projectBrief");
    }
    if ((summaries.review?.findings?.blocking ?? false) === true) {
      entries.push("reviewGate");
    }
  }

  if (goal === "decide") {
    const project = summaries.project ?? {};
    if (!project.purpose || !project.appType) {
      entries.push("projectBrief");
    }
  }

  return entries;
}

function estimateTokensFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  const bytes = fs.statSync(filePath).size;
  return Math.ceil(bytes / 4);
}

function isContextRelevantChangedFile(relativePath) {
  return (
    relativePath === "RELEASE_SUMMARY.md" ||
    relativePath.startsWith("sdd/memory-bank/core/") ||
    relativePath.startsWith("sdd/memory-bank/discovery/")
  );
}

function resolveEntry(repoRoot, entryId, changedFiles, source) {
  const definition = ENTRY_DEFS[entryId];
  if (!definition) {
    return null;
  }

  // Summary entries live in the layout's cache directory (see getCacheDir);
  // their ENTRY_DEFS.path stays a canonical .spectra/... display path.
  // Full-mode entries resolve against the data root.
  const absolutePath = definition.mode === "summary"
    ? path.join(getCacheDir(repoRoot), path.basename(definition.path))
    : path.join(repoRoot, definition.path);
  const exists = fs.existsSync(absolutePath);
  const relatedChanged = definition.sources.filter((candidate) => changedFiles.includes(candidate));

  return {
    id: entryId,
    label: definition.label,
    mode: definition.mode,
    source,
    path: definition.path,
    absolutePath,
    exists,
    changed: relatedChanged.length > 0,
    changedRefs: relatedChanged,
    estimatedTokens: estimateTokensFromFile(absolutePath)
  };
}

const MAX_REPO_INDEX_MODULES = 25;

// Minimal, additive bridge into the repo index (see `spectra index`): it never
// participates in token budgets or entry selection, so a project that has not
// run `spectra index` yet keeps producing exactly the same context pack as
// before. It only surfaces what the index already knows, never inferring
// business meaning of its own. In `--route-task` mode the module list is omitted:
// exact Repo Index records are resolved, budgeted entries there, so this stays
// metadata only (available/stats/hint).
function buildRepoIndexSummary(projectRoot, { includeModules = true } = {}) {
  const index = readRepoIndex(projectRoot);
  if (!index) {
    return { available: false };
  }

  const modules = index.records
    .filter((record) => record.kind === "module")
    .slice(0, MAX_REPO_INDEX_MODULES)
    .map((record) => ({
      id: record.id,
      name: record.name,
      path: record.path,
      ecosystem: record.ecosystem,
      confidence: record.confidence,
      status: record.status
    }));

  return {
    available: true,
    generatedAt: index.generatedAt,
    ecosystems: index.ecosystems,
    stats: index.stats,
    ...(includeModules ? { modules } : {}),
    hint: "Run `spectra index --explain` for full module/build/test/dependency evidence; `spectra index --check` to verify it is still current."
  };
}

function buildContextPack({
  cwd,
  role,
  goal,
  task,
  changed = false,
  base = null,
  head = null,
  routeTask = null,
  domains = [],
  modules = []
}) {
  const projectRoot = findSpectraRoot(cwd);

  if (!projectRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }
  const repoRoot = getContextRoot(projectRoot);

  const taskResolution = resolveTask(task);
  const resolvedRole = normalizeRole(role ?? taskResolution.role);
  const resolvedGoal = normalizeGoal(goal ?? taskResolution.goal);

  if (!resolvedRole) {
    throw new Error("Missing or invalid role. Use --role <planner|architect|implementer|reviewer|verifier|release-manager>.");
  }

  if (!resolvedGoal) {
    throw new Error("Missing or invalid goal. Use --goal <discover|decide|implement|verify|ship>.");
  }

  ensureContextSummaries(repoRoot);

  const summaries = {
    project: readSummary(repoRoot, "project.summary.json"),
    intake: readSummary(repoRoot, "intake.summary.json"),
    progress: readSummary(repoRoot, "progress.summary.json"),
    review: readSummary(repoRoot, "review.summary.json"),
    implementation: readSummary(repoRoot, "implementation.summary.json")
  };
  const changedFiles = getChangedFiles(repoRoot, { changed, base, head });

  const rolePolicy = ROLE_POLICIES[resolvedRole];
  const goalPolicy = GOAL_POLICIES[resolvedGoal];
  const selectedEntryIds = uniqueEntries([
    ...rolePolicy.defaults,
    ...goalPolicy.entries,
    ...chooseDynamicEntries(resolvedGoal, summaries)
  ]);

  const entries = selectedEntryIds
    .map((entryId) => resolveEntry(repoRoot, entryId, changedFiles, "policy"))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.changed !== right.changed) {
        return left.changed ? -1 : 1;
      }
      if (left.mode !== right.mode) {
        return left.mode === "summary" ? -1 : 1;
      }
      return left.path.localeCompare(right.path);
    });

  const relevantChangedFiles = changedFiles.filter(
    (candidate) =>
      isContextRelevantChangedFile(candidate) ||
      entries.some((entry) => entry.changedRefs.includes(candidate) || entry.path === candidate)
  );

  let avoid = rolePolicy.avoid.filter((candidate) => !entries.some((entry) => entry.path === candidate));
  let route;
  let knowledge;
  let selection;

  // `--route-task`: business/module routing plus exact Knowledge Map candidates.
  // The route's whole-file rule entries for matched domains are replaced by the
  // exact rule objects; the routing policy and the domain/module indexes stay.
  if (routeTask) {
    route = buildRoute({ cwd, task: routeTask, domains, modules });
    // Derived knowledge must never break context: on failure (for example a
    // duplicate rule ID that `spectra check` reports) fall back to whole-file routing.
    let resolved;
    try {
      resolved = resolveKnowledgeEntries({ projectRoot, task: routeTask, route, changedFiles });
    } catch (error) {
      resolved = { entries: [], mapStatus: "unavailable", error: error.message };
    }
    const existingPaths = new Set(entries.map((entry) => entry.path));
    const supersededFiles = new Set();
    const routingIndexes = [];
    for (const entry of route.entries) {
      if (existingPaths.has(entry.path)) continue;
      const absolutePath = path.join(route.repoRoot, entry.path);
      if (entry.reason.startsWith("domain: ") && !resolved.error && resolved.addressableSources.has(entry.path)) {
        // Exact rule objects replace the whole rules/unresolved file, but only when the
        // map can address rules in it; otherwise the whole file stays (it is not lost).
        supersededFiles.add(entry.path);
        continue;
      }
      const routed = {
        ...entry,
        absolutePath,
        exists: fs.existsSync(absolutePath),
        changed: false,
        changedRefs: [],
        estimatedTokens: estimateTokensFromFile(absolutePath),
        source: "route"
      };
      // The routing policy and fallback whole files are required; the module/domain
      // index files only explain routing, so they are the lowest optional tier.
      if (entry.reason === "module index" || entry.reason === "domain index") {
        routingIndexes.push(routed);
      } else {
        entries.push(routed);
      }
      existingPaths.add(entry.path);
    }
    const selected = selectContext({
      baseline: entries,
      resolved: resolved.entries,
      optionalBaseline: routingIndexes,
      budgets: rolePolicy.budgets,
      superseded: [...supersededFiles].map((entryPath) => ({ path: entryPath, estimatedTokens: estimateTokensFromFile(path.join(route.repoRoot, entryPath)) })),
      fallbackError: resolved.error
    });
    entries.push(...selected.entries);
    selection = selected.selection;
    avoid = [...new Set([...avoid, ...route.deferred, ...supersededFiles])].filter((candidate) => !existingPaths.has(candidate));
    // Routing decisions only: `entries` / `selection` are the final selected context.
    const budgetExcluded = new Set(selection.excluded.map((entry) => entry.id));
    route = {
      ...route,
      entries: route.entries.map((entry) => ({
        ...entry,
        selection: supersededFiles.has(entry.path) ? "superseded-by-exact-object" : budgetExcluded.has(entry.path) ? "excluded-by-budget" : "included"
      }))
    };
    knowledge = { map: resolved.mapStatus, resolved: resolved.entries.length, ...(resolved.error ? { error: resolved.error } : {}) };
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator.estimatedTokens += entry.estimatedTokens;
      // Resolved objects are markdown-sized content: they count toward `full`.
      accumulator[poolOf(entry)] += entry.estimatedTokens;
      return accumulator;
    },
    { estimatedTokens: 0, summary: 0, full: 0 }
  );

  return {
    repoRoot,
    role: resolvedRole,
    goal: resolvedGoal,
    task: task ?? null,
    changedFiles: relevantChangedFiles,
    budgets: rolePolicy.budgets,
    avoid,
    escalation: goalPolicy.escalation.map((entryId) => ENTRY_DEFS[entryId].path),
    entries,
    totals,
    repoIndex: buildRepoIndexSummary(projectRoot, { includeModules: !route }),
    ...(route ? { route, knowledge, selection } : {})
  };
}

export { buildContextPack, estimateTokensFromFile };
