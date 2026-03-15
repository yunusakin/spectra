import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureDirectory, findSpectraRoot } from "./runtime.js";
import { getFeatureDirs, readJsonContract } from "./specs.js";

const contextModuleFile = fileURLToPath(import.meta.url);

const ROLE_ALIASES = {
  pm: "planner",
  planner: "planner",
  architect: "architect",
  implementer: "implementer",
  reviewer: "reviewer",
  verifier: "verifier",
  "release-manager": "release-manager",
  release_manager: "release-manager"
};

const GOAL_ALIASES = {
  discover: "discover",
  decide: "decide",
  implement: "implement",
  verify: "verify",
  ship: "ship"
};

const TASK_ALIASES = {
  bootstrap: { role: "planner", goal: "discover" },
  "intake-core": { role: "planner", goal: "decide" },
  "brownfield-discovery": { role: "planner", goal: "discover" },
  "implementation-discuss": { role: "implementer", goal: "implement" },
  bugfix: { role: "implementer", goal: "implement" },
  "post-approval-api-change": { role: "reviewer", goal: "verify" },
  "post-approval-db-change": { role: "reviewer", goal: "verify" },
  "verify-work": { role: "verifier", goal: "verify" },
  release: { role: "release-manager", goal: "ship" },
  quick: { role: "planner", goal: "discover" }
};

const SUMMARY_SOURCES = {
  "project.summary.json": ["sdd/memory-bank/core/projectbrief.md"],
  "intake.summary.json": ["sdd/memory-bank/core/intake-state.md"],
  "progress.summary.json": ["sdd/memory-bank/core/progress.md"],
  "review.summary.json": ["sdd/memory-bank/core/review-gate.md"],
  "active-context.summary.json": ["sdd/memory-bank/core/activeContext.md"],
  "implementation.summary.json": ["sdd/memory-bank/core/implementation-brief.md"],
  "traceability.summary.json": ["sdd/memory-bank/core/traceability.md"],
  "discovery.summary.json": [
    "sdd/memory-bank/discovery/architecture.md",
    "sdd/memory-bank/discovery/concerns.md",
    "sdd/memory-bank/discovery/conventions.md",
    "sdd/memory-bank/discovery/integrations.md",
    "sdd/memory-bank/discovery/stack.md",
    "sdd/memory-bank/discovery/structure.md",
    "sdd/memory-bank/discovery/testing.md"
  ],
  "approval.summary.json": [
    "sdd/memory-bank/core/intake-state.md",
    "sdd/memory-bank/core/review-gate.md",
    "sdd/memory-bank/core/activeContext.md"
  ],
  "governance.summary.json": [
    "sdd/governance/approval-state.yaml",
    "sdd/governance/decision-graph.yaml"
  ],
  "feature-bundle.summary.json": ["sdd/features"],
  "shared-core.summary.json": [
    "sdd/memory-bank/core/projectbrief.md",
    "sdd/memory-bank/core/intake-state.md",
    "sdd/memory-bank/core/progress.md",
    "sdd/memory-bank/core/review-gate.md",
    "sdd/memory-bank/core/activeContext.md",
    "sdd/memory-bank/core/implementation-brief.md",
    "sdd/memory-bank/core/traceability.md",
    "sdd/governance/approval-state.yaml",
    "sdd/features"
  ]
};

const ENTRY_DEFS = {
  sharedCore: {
    label: "Shared Core Summary",
    mode: "summary",
    path: ".spectra/cache/context/shared-core.summary.json",
    sources: SUMMARY_SOURCES["shared-core.summary.json"]
  },
  projectSummary: {
    label: "Project Summary",
    mode: "summary",
    path: ".spectra/cache/context/project.summary.json",
    sources: SUMMARY_SOURCES["project.summary.json"]
  },
  intakeSummary: {
    label: "Intake Summary",
    mode: "summary",
    path: ".spectra/cache/context/intake.summary.json",
    sources: SUMMARY_SOURCES["intake.summary.json"]
  },
  progressSummary: {
    label: "Progress Summary",
    mode: "summary",
    path: ".spectra/cache/context/progress.summary.json",
    sources: SUMMARY_SOURCES["progress.summary.json"]
  },
  reviewSummary: {
    label: "Review Summary",
    mode: "summary",
    path: ".spectra/cache/context/review.summary.json",
    sources: SUMMARY_SOURCES["review.summary.json"]
  },
  activeSummary: {
    label: "Active Context Summary",
    mode: "summary",
    path: ".spectra/cache/context/active-context.summary.json",
    sources: SUMMARY_SOURCES["active-context.summary.json"]
  },
  implementationSummary: {
    label: "Implementation Summary",
    mode: "summary",
    path: ".spectra/cache/context/implementation.summary.json",
    sources: SUMMARY_SOURCES["implementation.summary.json"]
  },
  traceabilitySummary: {
    label: "Traceability Summary",
    mode: "summary",
    path: ".spectra/cache/context/traceability.summary.json",
    sources: SUMMARY_SOURCES["traceability.summary.json"]
  },
  discoverySummary: {
    label: "Discovery Summary",
    mode: "summary",
    path: ".spectra/cache/context/discovery.summary.json",
    sources: SUMMARY_SOURCES["discovery.summary.json"]
  },
  approvalSummary: {
    label: "Approval Summary",
    mode: "summary",
    path: ".spectra/cache/context/approval.summary.json",
    sources: SUMMARY_SOURCES["approval.summary.json"]
  },
  governanceSummary: {
    label: "Governance Summary",
    mode: "summary",
    path: ".spectra/cache/context/governance.summary.json",
    sources: SUMMARY_SOURCES["governance.summary.json"]
  },
  featureBundleSummary: {
    label: "Feature Bundle Summary",
    mode: "summary",
    path: ".spectra/cache/context/feature-bundle.summary.json",
    sources: SUMMARY_SOURCES["feature-bundle.summary.json"]
  },
  minimalRules: {
    label: "Minimal Runtime Rules",
    mode: "full",
    path: "sdd/system/runtime/minimal.md",
    sources: ["sdd/system/runtime/minimal.md"]
  },
  projectBrief: {
    label: "Project Brief",
    mode: "full",
    path: "sdd/memory-bank/core/projectbrief.md",
    sources: ["sdd/memory-bank/core/projectbrief.md"]
  },
  implementationBrief: {
    label: "Implementation Brief",
    mode: "full",
    path: "sdd/memory-bank/core/implementation-brief.md",
    sources: ["sdd/memory-bank/core/implementation-brief.md"]
  },
  invariants: {
    label: "Invariants",
    mode: "full",
    path: "sdd/memory-bank/core/invariants.md",
    sources: ["sdd/memory-bank/core/invariants.md"]
  },
  reviewGate: {
    label: "Review Gate",
    mode: "full",
    path: "sdd/memory-bank/core/review-gate.md",
    sources: ["sdd/memory-bank/core/review-gate.md"]
  },
  progress: {
    label: "Progress",
    mode: "full",
    path: "sdd/memory-bank/core/progress.md",
    sources: ["sdd/memory-bank/core/progress.md"]
  },
  traceability: {
    label: "Traceability Map",
    mode: "full",
    path: "sdd/memory-bank/core/traceability.md",
    sources: ["sdd/memory-bank/core/traceability.md"]
  },
  releaseSummary: {
    label: "Release Summary",
    mode: "full",
    path: "RELEASE_SUMMARY.md",
    sources: ["RELEASE_SUMMARY.md"]
  }
};

const ROLE_POLICIES = {
  planner: {
    defaults: ["sharedCore", "projectSummary", "intakeSummary", "activeSummary", "governanceSummary", "featureBundleSummary"],
    avoid: [
      "sdd/memory-bank/core/spec-history.md",
      "sdd/memory-bank/core/progress-archive.md",
      "sdd/memory-bank/core/activeContext-archive.md",
      "sdd/memory-bank/discovery/*.md"
    ],
    budgets: { summaryTokens: 2600, markdownTokens: 700 }
  },
  architect: {
    defaults: ["sharedCore", "projectSummary", "discoverySummary", "traceabilitySummary", "invariants", "featureBundleSummary", "governanceSummary"],
    avoid: [
      "sdd/memory-bank/core/spec-history.md",
      "sdd/memory-bank/core/progress-archive.md",
      "sdd/memory-bank/core/review-gate.md"
    ],
    budgets: { summaryTokens: 3200, markdownTokens: 1000 }
  },
  implementer: {
    defaults: ["sharedCore", "implementationSummary", "traceabilitySummary", "reviewSummary", "implementationBrief", "featureBundleSummary", "governanceSummary"],
    avoid: [
      "sdd/memory-bank/core/spec-history.md",
      "sdd/memory-bank/discovery/*.md",
      "sdd/memory-bank/core/projectbrief.md"
    ],
    budgets: { summaryTokens: 3200, markdownTokens: 1200 }
  },
  reviewer: {
    defaults: ["sharedCore", "reviewSummary", "progressSummary", "traceabilitySummary", "approvalSummary", "featureBundleSummary", "governanceSummary"],
    avoid: [
      "sdd/memory-bank/core/spec-history.md",
      "sdd/memory-bank/discovery/*.md",
      "sdd/memory-bank/core/projectbrief.md"
    ],
    budgets: { summaryTokens: 3000, markdownTokens: 800 }
  },
  verifier: {
    defaults: ["sharedCore", "reviewSummary", "progressSummary", "traceabilitySummary", "approvalSummary", "featureBundleSummary", "governanceSummary"],
    avoid: [
      "sdd/memory-bank/core/spec-history.md",
      "sdd/memory-bank/discovery/*.md",
      "sdd/memory-bank/core/projectbrief.md"
    ],
    budgets: { summaryTokens: 2800, markdownTokens: 700 }
  },
  "release-manager": {
    defaults: ["sharedCore", "approvalSummary", "reviewSummary", "progressSummary", "releaseSummary", "governanceSummary", "featureBundleSummary"],
    avoid: [
      "sdd/memory-bank/core/spec-history.md",
      "sdd/memory-bank/discovery/*.md",
      "sdd/memory-bank/core/implementation-brief.md"
    ],
    budgets: { summaryTokens: 2600, markdownTokens: 700 }
  }
};

const GOAL_POLICIES = {
  discover: {
    entries: ["minimalRules", "discoverySummary", "projectSummary", "intakeSummary", "governanceSummary", "featureBundleSummary"],
    escalation: ["projectBrief", "invariants"]
  },
  decide: {
    entries: ["minimalRules", "projectSummary", "activeSummary", "projectBrief", "featureBundleSummary", "governanceSummary"],
    escalation: ["invariants", "discoverySummary"]
  },
  implement: {
    entries: ["implementationSummary", "implementationBrief", "traceabilitySummary", "reviewSummary", "featureBundleSummary", "governanceSummary"],
    escalation: ["projectBrief", "reviewGate", "traceability"]
  },
  verify: {
    entries: ["approvalSummary", "reviewSummary", "progressSummary", "traceabilitySummary", "featureBundleSummary", "governanceSummary"],
    escalation: ["reviewGate", "progress", "traceability"]
  },
  ship: {
    entries: ["approvalSummary", "reviewSummary", "progressSummary", "releaseSummary", "featureBundleSummary", "governanceSummary"],
    escalation: ["reviewGate", "progress"]
  }
};

function normalizeRole(role) {
  if (!role) {
    return null;
  }
  return ROLE_ALIASES[role] ?? null;
}

function normalizeGoal(goal) {
  if (!goal) {
    return null;
  }
  return GOAL_ALIASES[goal] ?? null;
}

function parseSections(markdown) {
  const sections = {};
  const lines = markdown.replace(/\r/g, "").split("\n");
  let current = "__root__";
  sections[current] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      current = headingMatch[1].trim();
      sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, value.join("\n").trim()])
  );
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isPlaceholderValue(value) {
  const normalized = normalizeWhitespace(String(value ?? ""));
  return (
    normalized === "" ||
    normalized === "-" ||
    normalized === "(none)" ||
    normalized === "(n/a)" ||
    /^`?<[^>]+>`?$/.test(normalized) ||
    /^`?<(none|n\/a)[^>]*>`?$/i.test(normalized) ||
    /^`[^`]*\|[^`]*`$/.test(normalized) ||
    /^`?<pending.*>`?$/i.test(normalized) ||
    /^`?<done.*>`?$/i.test(normalized) ||
    /^`?<0-100%>`?$/.test(normalized) ||
    /^`?<milestone>`?$/.test(normalized) ||
    /^`?<step>`?$/.test(normalized) ||
    /^`?<important context>`?$/.test(normalized) ||
    /^`?<target-project-name>`?$/.test(normalized) ||
    /^`?<absolute-target-project-path>`?$/.test(normalized) ||
    /^`?<owner\/repo or local>`?$/.test(normalized) ||
    /^`?<owner-or-team>`?$/.test(normalized) ||
    /^`?<item-id>`?$/.test(normalized) ||
    /^`?<one-sentence objective for the target project>`?$/.test(normalized) ||
    /^YYYY-MM-DD/.test(normalized)
  );
}

function isTemplateLine(line) {
  return (
    isPlaceholderValue(line) ||
    /^>\s/.test(line) ||
    /^#{1,6}\s/.test(line) ||
    /\bFilled by intake\b/i.test(line) ||
    /\bFilled before execution\b/i.test(line) ||
    /^- \((none|n\/a)\)$/i.test(line)
  );
}

function meaningfulLines(text) {
  return stripComments(text)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => !isTemplateLine(line));
}

function firstMeaningfulLine(text) {
  const [line] = meaningfulLines(text);
  const value = line ? line.replace(/^[-*]\s+/, "") : null;
  return isPlaceholderValue(value) ? null : value;
}

function extractList(text, limit = 5) {
  const items = stripComments(text)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""))
    .filter((line) => !isPlaceholderValue(line));
  return items.slice(0, limit);
}

function extractChecklist(text) {
  return stripComments(text)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => /^- \[[ xX]\]\s+/.test(line))
    .map((line) => ({
      label: line.replace(/^- \[[ xX]\]\s+/, ""),
      done: /^- \[[xX]\]/.test(line)
    }));
}

function extractBulletMap(text) {
  const map = {};
  for (const line of stripComments(text).split(/\r?\n/)) {
    const trimmed = normalizeWhitespace(line);
    const match = trimmed.match(/^-\s+([^:]+):\s+(.+)$/);
    if (!match) {
      continue;
    }
    const value = match[2].trim();
    if (isPlaceholderValue(value)) {
      continue;
    }
    map[match[1].trim()] = value;
  }
  return map;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => normalizeWhitespace(cell));
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function isPlaceholderRow(cells) {
  return cells.every(
    (cell) => isPlaceholderValue(cell) || /^<[^>]+>$/.test(cell) || /^(none|n\/a|no)$/i.test(normalizeWhitespace(cell))
  );
}

function parseMarkdownTable(text) {
  const lines = stripComments(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 2) {
    return [];
  }

  const headers = splitTableRow(lines[0]).map(normalizeHeader);
  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitTableRow(lines[index]);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      continue;
    }
    if (isPlaceholderRow(cells)) {
      continue;
    }
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = cells[headerIndex] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function countByStatus(rows, fieldName, mapping) {
  const result = {};
  for (const key of Object.keys(mapping)) {
    result[key] = 0;
  }

  for (const row of rows) {
    const value = (row[fieldName] ?? "").toLowerCase();
    for (const [key, matcher] of Object.entries(mapping)) {
      if (matcher(value)) {
        result[key] += 1;
      }
    }
  }

  return result;
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

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

function getCacheDir(repoRoot) {
  return path.join(repoRoot, ".spectra", "cache", "context");
}

function needsRebuild(outputPath, sourcePaths) {
  if (!fs.existsSync(outputPath)) {
    return true;
  }

  const outputMtime = fs.statSync(outputPath).mtimeMs;
  return [contextModuleFile, ...sourcePaths].some(
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

function resolveTask(task) {
  if (!task) {
    return {};
  }
  return TASK_ALIASES[task] ?? {};
}

function readSummary(repoRoot, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function getChangedFiles(repoRoot, { changed = false, base = null, head = null } = {}) {
  const isGit = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: repoRoot,
    stdio: "ignore"
  }).status === 0;

  if (!isGit) {
    return [];
  }

  const seen = new Set();
  const addLines = (result) => {
    if (result.status !== 0) {
      return;
    }
    for (const line of result.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) {
        seen.add(trimmed);
      }
    }
  };

  if (base) {
    addLines(
      spawnSync("git", ["diff", "--name-only", base, head ?? "HEAD"], {
        cwd: repoRoot,
        encoding: "utf8"
      })
    );
    return [...seen];
  }

  if (!changed) {
    return [];
  }

  addLines(
    spawnSync("git", ["diff", "--name-only", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8"
    })
  );
  addLines(
    spawnSync("git", ["diff", "--cached", "--name-only"], {
      cwd: repoRoot,
      encoding: "utf8"
    })
  );
  addLines(
    spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
      cwd: repoRoot,
      encoding: "utf8"
    })
  );

  return [...seen];
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

  const absolutePath = path.join(repoRoot, definition.path);
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

function buildContextPack({
  cwd,
  role,
  goal,
  task,
  changed = false,
  base = null,
  head = null
}) {
  const repoRoot = findSpectraRoot(cwd);

  if (!repoRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }

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
    project: readSummary(repoRoot, ".spectra/cache/context/project.summary.json"),
    intake: readSummary(repoRoot, ".spectra/cache/context/intake.summary.json"),
    progress: readSummary(repoRoot, ".spectra/cache/context/progress.summary.json"),
    review: readSummary(repoRoot, ".spectra/cache/context/review.summary.json"),
    implementation: readSummary(repoRoot, ".spectra/cache/context/implementation.summary.json")
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
    totals
  };
}

export {
  buildContextPack,
  ensureContextSummaries,
  normalizeGoal,
  normalizeRole
};
