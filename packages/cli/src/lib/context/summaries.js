import fs from "node:fs";
import path from "node:path";
import { ensureDirectory } from "../runtime.js";
import { SUMMARY_SOURCES } from "./sources.js";
import { getCacheDir } from "./roots.js";
import { parseApprovalSummary, parseFeatureBundleSummary, parseGovernanceSummary } from "./governance-summaries.js";
import {
  parseActiveContextSummary,
  parseDiscoverySummary,
  parseImplementationSummary,
  parseIntakeSummary,
  parseProgressSummary,
  parseProjectSummary,
  parseReviewSummary,
  parseTraceabilitySummary
} from "./memory-summaries.js";

function parseSharedCoreSummary(repoRoot) {
  const project = parseProjectSummary(repoRoot);
  const intake = parseIntakeSummary(repoRoot);
  const progress = parseProgressSummary(repoRoot);
  const review = parseReviewSummary(repoRoot);
  const active = parseActiveContextSummary(repoRoot);
  const traceability = parseTraceabilitySummary(repoRoot);
  const implementation = parseImplementationSummary(repoRoot);

  return {
    generatedAt: new Date().toISOString(),
    project: {
      name: project.projectName,
      purpose: project.purpose,
      appType: project.appType
    },
    intake: {
      currentPhase: intake.currentPhase,
      approvalStatus: intake.approvalStatus,
      missingMandatoryAnswers: intake.missingMandatoryAnswers.length,
      openTechnicalQuestions: intake.openQuestions.open
    },
    activeFocus: {
      phase: active.currentFocus["Current Phase"],
      objective: active.currentFocus["Current Objective"],
      sprintItem: active.currentFocus["Current Sprint Item"]
    },
    progress: {
      overallStatus: progress.progressSummary["Overall Status"],
      completion: progress.progressSummary.Completion,
      currentMilestone: progress.progressSummary["Current Milestone"],
      nextMilestone: progress.progressSummary["Next Milestone"]
    },
    review: review.findings,
    traceability: {
      mappedRequirements: traceability.mappedRequirements,
      statusCounts: traceability.statusCounts
    },
    governance: parseGovernanceSummary(repoRoot),
    featureBundles: parseFeatureBundleSummary(repoRoot),
    implementation: {
      itemId: implementation.itemId,
      taskType: implementation.taskType,
      goal: implementation.goal
    }
  };
}

const SUMMARY_BUILDERS = {
  "project.summary.json": parseProjectSummary,
  "intake.summary.json": parseIntakeSummary,
  "progress.summary.json": parseProgressSummary,
  "review.summary.json": parseReviewSummary,
  "active-context.summary.json": parseActiveContextSummary,
  "implementation.summary.json": parseImplementationSummary,
  "traceability.summary.json": parseTraceabilitySummary,
  "discovery.summary.json": parseDiscoverySummary,
  "approval.summary.json": parseApprovalSummary,
  "governance.summary.json": parseGovernanceSummary,
  "feature-bundle.summary.json": parseFeatureBundleSummary,
  "shared-core.summary.json": parseSharedCoreSummary
};

// Every module in this directory. In a bundled (native) build the directory does
// not exist on disk, so an unreadable directory means "nothing to compare".
function listContextModules() {
  try {
    const contextDir = new URL("./", import.meta.url);
    return fs.readdirSync(contextDir).filter((name) => name.endsWith(".js")).map((name) => new URL(name, contextDir));
  } catch {
    return [];
  }
}

function needsRebuild(outputPath, sourcePaths) {
  if (!fs.existsSync(outputPath)) {
    return true;
  }

  // Any change to a context module (policies, sources, parsing, summaries,
  // pack selection) invalidates generated summaries, not just the facade.
  const contextModuleFiles = import.meta.url ? [new URL("../context.js", import.meta.url), ...listContextModules()] : [];
  const outputMtime = fs.statSync(outputPath).mtimeMs;
  return [...contextModuleFiles, ...sourcePaths].filter(Boolean).some(
    (sourcePath) => fs.existsSync(sourcePath) && fs.statSync(sourcePath).mtimeMs > outputMtime
  );
}

function ensureContextSummaries(repoRoot) {
  const cacheDir = getCacheDir(repoRoot);
  ensureDirectory(cacheDir);

  for (const [fileName, builder] of Object.entries(SUMMARY_BUILDERS)) {
    const outputPath = path.join(cacheDir, fileName);
    const sourcePaths = (SUMMARY_SOURCES[fileName] ?? []).map((relativePath) => path.join(repoRoot, relativePath));
    if (!needsRebuild(outputPath, sourcePaths)) {
      continue;
    }

    const payload = builder(repoRoot);
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  }
}

export { ensureContextSummaries };
