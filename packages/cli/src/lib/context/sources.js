// Source definitions: where each summary and entry reads from.
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

export { ENTRY_DEFS, SUMMARY_SOURCES };
