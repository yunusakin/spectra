import fs from "node:fs";
import path from "node:path";
import { SUMMARY_SOURCES } from "./sources.js";
import { countByStatus, extractBulletMap, extractChecklist, extractList, firstMeaningfulLine, parseMarkdownTable, parseSections, readTextIfExists } from "./markdown.js";

// Summaries of the memory-bank markdown files (project, intake, progress, review, focus, implementation, traceability, discovery).
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

export { parseProjectSummary, parseIntakeSummary, parseProgressSummary, parseReviewSummary, parseActiveContextSummary, parseImplementationSummary, parseTraceabilitySummary, parseDiscoverySummary };
