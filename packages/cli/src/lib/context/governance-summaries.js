import path from "node:path";
import { getFeatureDirs, readJsonContract } from "../specs.js";
import { parseActiveContextSummary, parseIntakeSummary, parseReviewSummary } from "./memory-summaries.js";

// Summaries of approval state, governance contracts and feature bundles.
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

export { parseApprovalSummary, parseGovernanceSummary, parseFeatureBundleSummary };
