import fs from "node:fs";
import path from "node:path";
import { ensureDirectory, findSpectraRoot } from "../runtime.js";
import { readIndex as readRepoIndex } from "../index/cache.js";
import { getChangedFiles as collectChangedFiles } from "../git-diff.js";
import { ENTRY_DEFS } from "./sources.js";
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
// business meaning of its own.
function buildRepoIndexSummary(projectRoot) {
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
    modules,
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
  head = null
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

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator.estimatedTokens += entry.estimatedTokens;
      accumulator[entry.mode] += entry.estimatedTokens;
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
    avoid: rolePolicy.avoid.filter((candidate) => !entries.some((entry) => entry.path === candidate)),
    escalation: goalPolicy.escalation.map((entryId) => ENTRY_DEFS[entryId].path),
    entries,
    totals,
    repoIndex: buildRepoIndexSummary(projectRoot)
  };
}

export { buildContextPack, estimateTokensFromFile };
