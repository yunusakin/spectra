import fs from "node:fs";
import path from "node:path";
import { ensureDirectory } from "../runtime.js";
import { getFeatureDirs, readJsonContract } from "../specs.js";
import { SUMMARY_SOURCES } from "./sources.js";
import { getCacheDir } from "./roots.js";
import { countByStatus, extractBulletMap, extractChecklist, extractList, firstMeaningfulLine, parseMarkdownTable, parseSections, readTextIfExists } from "./markdown.js";

function parseProjectSummary(repoRoot) {
  const relativePath = "sdd/memory-bank/core/projectbrief.md";
  const text = readTextIfExists(path.join(repoRoot, relativePath));
  const sections = parseSections(text);

  return {
    source: relativePath,
    projectName: firstMeaningfulLine(sections["Project Name"] ?? ""),
    purpose: firstMeaningfulLine(sections["Purpose"] ?? ""),
    appType: firstMeaningfulLine(sections["App Type"] ?? ""),
    productContext: extractList(sections["Product Context"] ?? "", 3),
    requirements: extractList(sections["Requirements"] ?? "", 3),
    constraints: extractList(sections["Constraints"] ?? "", 3)
  };
}

function parseIntakeSummary(repoRoot) {
  const relativePath = "sdd/memory-bank/core/intake-state.md";
  const text = readTextIfExists(path.join(repoRoot, relativePath));
  const sections = parseSections(text);
  const openQuestions = parseMarkdownTable(sections["Open Technical Questions"] ?? "");
  const decisionLog = parseMarkdownTable(sections["Decision Log"] ?? "");
  const openStatus = countByStatus(openQuestions, "status", {
    open: (value) => value === "open",
    resolved: (value) => value === "resolved",
    blocked: (value) => value === "blocked"
  });

  return {
    source: relativePath,
    currentPhase: firstMeaningfulLine(sections["Current Phase"] ?? ""),
    approvalStatus: firstMeaningfulLine(sections["Approval Status"] ?? ""),
    phaseCompletion: extractChecklist(sections["Phase Completion"] ?? ""),
    missingMandatoryAnswers: extractList(sections["Missing Mandatory Answers"] ?? "", 4),
    validationErrors: extractList(sections["Validation Errors"] ?? "", 4),
    decisionCount: decisionLog.length,
    openQuestions: {
      total: openQuestions.length,
      open: openStatus.open,
      resolved: openStatus.resolved,
      blocked: openStatus.blocked,
      preview: openQuestions.slice(0, 3).map((row) => ({
        id: row.question_id,
        question: row.question,
        status: row.status
      }))
    },
    lastUpdated: firstMeaningfulLine(sections["Last Updated"] ?? ""),
    discoveredSignals: extractList(sections["Discovered Signals"] ?? "", 4)
  };
}

function parseProgressSummary(repoRoot) {
  const relativePath = "sdd/memory-bank/core/progress.md";
  const text = readTextIfExists(path.join(repoRoot, relativePath));
  const sections = parseSections(text);
  const completed = parseMarkdownTable(sections.Completed ?? "");
  const inProgress = parseMarkdownTable(sections["In Progress"] ?? "");
  const blocked = parseMarkdownTable(sections.Blocked ?? "");

  return {
    source: relativePath,
    projectBinding: extractBulletMap(sections["Project Binding"] ?? ""),
    progressSummary: extractBulletMap(sections["Progress Summary"] ?? ""),
    counts: {
      completed: completed.length,
      inProgress: inProgress.length,
      blocked: blocked.length
    },
    validationSnapshot: extractBulletMap(sections["Validation Snapshot"] ?? ""),
    sessionBoundary: extractBulletMap(sections["Session Boundary"] ?? "")
  };
}

function parseReviewSummary(repoRoot) {
  const relativePath = "sdd/memory-bank/core/review-gate.md";
  const text = readTextIfExists(path.join(repoRoot, relativePath));
  const sections = parseSections(text);
  const findings = parseMarkdownTable(sections.Findings ?? "");
  const openFindings = findings.filter((row) => (row.status ?? "").toLowerCase() === "open");

  const openBySeverity = countByStatus(openFindings, "severity", {
    critical: (value) => value === "critical",
    warning: (value) => value === "warning",
    note: (value) => value === "note"
  });

  return {
    source: relativePath,
    findings: {
      total: findings.length,
      open: openFindings.length,
      openCritical: openBySeverity.critical,
      openWarning: openBySeverity.warning,
      openNote: openBySeverity.note,
      blocking: openBySeverity.critical > 0 || openBySeverity.warning > 0
    }
  };
}

function parseActiveContextSummary(repoRoot) {
  const relativePath = "sdd/memory-bank/core/activeContext.md";
  const text = readTextIfExists(path.join(repoRoot, relativePath));
  const sections = parseSections(text);
  const decisions = parseMarkdownTable(sections["Open Decisions"] ?? "");

  return {
    source: relativePath,
    projectBinding: extractBulletMap(sections["Project Binding"] ?? ""),
    currentFocus: extractBulletMap(sections["Current Focus"] ?? ""),
    stateSnapshot: extractBulletMap(sections["State Snapshot"] ?? ""),
    openDecisions: {
      total: decisions.length,
      blocking: decisions.filter((row) => (row.blocking ?? "").toLowerCase() === "yes").length
    },
    sessionBoundary: extractBulletMap(sections["Session Boundary"] ?? "")
  };
}

function parseImplementationSummary(repoRoot) {
  const relativePath = "sdd/memory-bank/core/implementation-brief.md";
  const text = readTextIfExists(path.join(repoRoot, relativePath));
  const sections = parseSections(text);

  return {
    source: relativePath,
    itemId: firstMeaningfulLine(sections["Item ID"] ?? ""),
    taskType: firstMeaningfulLine(sections["Task Type"] ?? ""),
    goal: firstMeaningfulLine(sections.Goal ?? ""),
    scopeNotes: firstMeaningfulLine(sections["Scope Notes"] ?? ""),
    interfaceImpact: firstMeaningfulLine(sections["Interface Impact"] ?? ""),
    risks: firstMeaningfulLine(sections.Risks ?? ""),
    testIntent: firstMeaningfulLine(sections["Test Intent"] ?? ""),
    openQuestions: extractList(sections["Open Implementation Questions"] ?? "", 3)
  };
}

function parseTraceabilitySummary(repoRoot) {
  const relativePath = "sdd/memory-bank/core/traceability.md";
  const text = readTextIfExists(path.join(repoRoot, relativePath));
  const sections = parseSections(text);
  const rows = parseMarkdownTable(sections["Feature Map"] ?? "");
  const statusCounts = {
    done: 0,
    inProgress: 0,
    blocked: 0,
    notStarted: 0
  };

  for (const row of rows) {
    const status = row.status ?? "";
    if (/✅|done/i.test(status)) {
      statusCounts.done += 1;
    } else if (/🔄|in progress/i.test(status)) {
      statusCounts.inProgress += 1;
    } else if (/❌|blocked/i.test(status)) {
      statusCounts.blocked += 1;
    } else {
      statusCounts.notStarted += 1;
    }
  }

  return {
    source: relativePath,
    mappedRequirements: rows.length,
    statusCounts,
    preview: rows.slice(0, 5).map((row) => ({
      requirement: row.requirement,
      status: row.status,
      code: row.code_location,
      tests: row.test_location
    }))
  };
}

function parseDiscoverySummary(repoRoot) {
  const discoveryDir = path.join(repoRoot, "sdd", "memory-bank", "discovery");
  const relativeFiles = SUMMARY_SOURCES["discovery.summary.json"];
  const documents = [];

  for (const relativePath of relativeFiles) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const firstLine = firstMeaningfulLine(readTextIfExists(absolutePath));
    if (!firstLine) {
      continue;
    }

    documents.push({
      path: relativePath,
      preview: firstLine
    });
  }

  return {
    source: discoveryDir,
    documents: documents.slice(0, 6),
    documentCount: documents.length
  };
}

function parseApprovalSummary(repoRoot) {
  const intake = parseIntakeSummary(repoRoot);
  const review = parseReviewSummary(repoRoot);
  const active = parseActiveContextSummary(repoRoot);
  const governancePath = path.join(repoRoot, "sdd", "governance", "approval-state.yaml");
  const governance = readJsonContract(governancePath, null);

  return {
    sources: [
      "sdd/memory-bank/core/intake-state.md",
      "sdd/memory-bank/core/review-gate.md",
      "sdd/memory-bank/core/activeContext.md"
    ],
    approvalStatus:
      governance?.highest_valid_state ??
      intake.approvalStatus ??
      active.stateSnapshot["Approval Status"] ??
      "unknown",
    currentPhase: intake.currentPhase ?? active.currentFocus["Current Phase"] ?? null,
    openTechnicalQuestions: intake.openQuestions.open,
    openBlockingReviewFindings: review.findings.openCritical + review.findings.openWarning,
    blocking: review.findings.blocking || intake.openQuestions.open > 0
  };
}

function parseGovernanceSummary(repoRoot) {
  const approval = readJsonContract(path.join(repoRoot, "sdd", "governance", "approval-state.yaml"), null);
  const decisionGraph = readJsonContract(path.join(repoRoot, "sdd", "governance", "decision-graph.yaml"), null);

  return {
    source: "sdd/governance",
    approval: approval
      ? {
          currentState: approval.current_state,
          highestValidState: approval.highest_valid_state,
          invalidations: approval.invalidations ?? []
        }
      : null,
    decisions: {
      total: decisionGraph?.decisions?.length ?? 0,
      critical: (decisionGraph?.decisions ?? []).filter((decision) => decision.risk_level === "critical").length
    }
  };
}

function parseFeatureBundleSummary(repoRoot) {
  const featureDirs = getFeatureDirs(repoRoot);
  const features = featureDirs.map((featureDir) => {
    const featureSpec = readJsonContract(path.join(featureDir, "feature.spec.yaml"), null);
    const behaviorSpec = readJsonContract(path.join(featureDir, "ai-behavior-spec.yaml"), null);
    const telemetryContract = readJsonContract(path.join(featureDir, "telemetry-contract.yaml"), null);
    const regressionSuite = readJsonContract(path.join(featureDir, "evals", "regression-suite.yaml"), null);
    const releaseThresholds = readJsonContract(path.join(featureDir, "release-thresholds.yaml"), null);

    return {
      id: featureSpec?.metadata?.id ?? path.basename(featureDir),
      status: featureSpec?.metadata?.status ?? "unknown",
      requirements:
        (featureSpec?.requirements?.functional ?? []).length +
        (featureSpec?.requirements?.nonFunctional ?? []).length,
      toolContracts: (behaviorSpec?.tool_contracts ?? []).length,
      telemetrySignals:
        (telemetryContract?.success_signals ?? []).length +
        (telemetryContract?.failure_signals ?? []).length,
      evalSuites: (regressionSuite?.suites ?? []).map((suite) => suite.id),
      releaseSuite: releaseThresholds?.gates?.evals?.required_suite ?? null
    };
  });

  return {
    source: "sdd/features",
    featureCount: features.length,
    features
  };
}

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

// True when repoRoot is itself a data directory (holds both install.json

function needsRebuild(outputPath, sourcePaths) {
  if (!fs.existsSync(outputPath)) {
    return true;
  }

  // Any change to a context module (policies, sources, parsing, summaries,
  // pack selection) invalidates generated summaries, not just the facade.
  const contextModuleFiles = [
    new URL("../context.js", import.meta.url),
    new URL("./markdown.js", import.meta.url),
    new URL("./pack.js", import.meta.url),
    new URL("./policies.js", import.meta.url),
    new URL("./roots.js", import.meta.url),
    new URL("./sources.js", import.meta.url),
    new URL("./summaries.js", import.meta.url)
  ];
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
