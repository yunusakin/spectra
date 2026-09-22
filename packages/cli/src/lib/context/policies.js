// Role/goal/task aliases, entry policies, and token budgets.
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

function resolveTask(task) {
  if (!task) {
    return {};
  }
  return TASK_ALIASES[task] ?? {};
}

export { GOAL_POLICIES, ROLE_POLICIES, normalizeGoal, normalizeRole, resolveTask };
