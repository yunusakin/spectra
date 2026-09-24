import fs from "node:fs";
import path from "node:path";
import { checkIndexFreshness } from "../index/cache.js";
import { getCacheRoot, getSddRoot } from "../project-layout.js";
import { stageOrder } from "./stages.js";
import { getFeatureBundle, getFeatureDirs } from "./feature-bundles.js";
import { hasRealMarkdownContent, readJsonContract, readMarkdown } from "./primitives.js";
import { validateSpectraV2 } from "./validation.js";
import { computeApprovalState } from "./approval-state.js";
import { runEvalSuite } from "./evaluation.js";

function verifyV2(repoRoot, { scope = "all", item = null, profile = "standard", shellStatus = 0 } = {}) {
  const validation = validateSpectraV2(repoRoot);
  const approvalState = computeApprovalState(repoRoot);
  const reviewSummary = readJsonContract(path.join(getCacheRoot(repoRoot), "context", "review.summary.json"), {
    findings: { openCritical: 0, openWarning: 0, blocking: false }
  });
  const stages = [];

  const structureStage = {
    name: "structure",
    blocking: validation.errors.length > 0,
    warnings: validation.warnings,
    score: validation.errors.length > 0 ? 0 : validation.warnings.length > 0 ? 0.7 : 1,
    detail: `${validation.errors.length} errors, ${validation.warnings.length} warnings`
  };
  stages.push(structureStage);

  const requiredStage = scope === "app" || item ? "implementation-approved" : "technical-approved";
  const policyBlocked =
    stageOrder(approvalState.highest_valid_state) < stageOrder(requiredStage) ||
    reviewSummary?.findings?.blocking === true;
  stages.push({
    name: "policy",
    blocking: policyBlocked,
    warnings: approvalState.invalidations.map((entry) => `${entry.stage}: ${entry.categories.join(", ")}`),
    score: policyBlocked ? 0 : approvalState.invalidations.length > 0 ? 0.5 : 1,
    detail: `highest valid stage: ${approvalState.highest_valid_state}`
  });

  const evalReport = runEvalSuite(repoRoot, { suiteId: profile === "release" ? "release" : "smoke" });
  stages.push({
    name: "evals",
    blocking: profile === "release" ? !evalReport.passed : false,
    warnings: evalReport.passed ? [] : ["eval suite is below release threshold"],
    score: evalReport.passed ? 1 : 0.4,
    detail: `pass rate ${evalReport.totals.pass_rate.toFixed(2)}`
  });

  const telemetryWarnings = [];
  const featureDirs = getFeatureDirs(repoRoot);
  for (const featureDir of featureDirs) {
    const paths = getFeatureBundle(repoRoot, featureDir);
    const telemetry = readJsonContract(paths.telemetryContractPath, null);
    if ((telemetry?.alert_conditions ?? []).length === 0) {
      telemetryWarnings.push(`${path.relative(repoRoot, paths.telemetryContractPath)} has no alert conditions`);
    }
  }
  stages.push({
    name: "telemetry",
    blocking: false,
    warnings: telemetryWarnings,
    score: telemetryWarnings.length === 0 ? 1 : 0.7,
    detail: `${telemetryWarnings.length} warning(s)`
  });

  const releaseChecklistWarnings = [];
  if (profile === "release") {
    for (const featureDir of featureDirs) {
      const checklistPath = path.join(featureDir, "release-checklist.md");
      const markdown = readMarkdown(checklistPath);
      const unchecked = markdown.split(/\r?\n/).filter((line) => /^- \[ \]/.test(line)).length;
      if (unchecked > 0) {
        releaseChecklistWarnings.push(`${path.relative(repoRoot, checklistPath)} has ${unchecked} unchecked item(s)`);
      }
    }
  }
  const releaseBlocked =
    profile === "release" &&
    (releaseChecklistWarnings.length > 0 ||
      stageOrder(approvalState.highest_valid_state) < stageOrder("implementation-approved"));
  stages.push({
    name: "release-readiness",
    blocking: releaseBlocked,
    warnings: releaseChecklistWarnings,
    score: releaseBlocked ? 0.3 : 1,
    detail: profile === "release" ? `current stage: ${approvalState.highest_valid_state}` : "profile standard"
  });

  const indexFreshness = checkIndexFreshness(repoRoot);
  stages.push({
    name: "repo-index",
    blocking: false,
    warnings:
      indexFreshness.status === "missing"
        ? ['No repo index found. Run "spectra index".']
        : indexFreshness.status === "stale"
          ? ['Repo index is stale. Run "spectra index" to refresh it.']
          : [],
    score: indexFreshness.status === "fresh" ? 1 : indexFreshness.status === "stale" ? 0.5 : 0.7,
    detail:
      indexFreshness.status === "missing"
        ? "not built yet"
        : indexFreshness.status === "stale"
          ? "stale, needs refresh"
          : `fresh (${indexFreshness.cached.ecosystems.join(", ") || "no ecosystem detected"})`
  });

  const weights = {
    structure: 10,
    policy: 20,
    "verify-work": 20,
    evals: 20,
    telemetry: 10,
    "release-readiness": 15,
    "repo-index": 5
  };

  const missingImplementationBrief =
    !hasRealMarkdownContent(path.join(getSddRoot(repoRoot), "memory-bank", "core", "implementation-brief.md")) &&
    (scope === "app" || item);
  // This stage does NOT run project tests. It reflects the verify-work.sh
  // shell checks (manifest, policy and memory-bank files) plus whether the
  // implementation brief has real content, so it is named for that.
  const verifyWorkScore = shellStatus === 0 ? (missingImplementationBrief ? 0.4 : 1) : 0.2;
  stages.splice(2, 0, {
    name: "verify-work",
    blocking: shellStatus !== 0 || (scope === "app" && verifyWorkScore < 1),
    warnings:
      shellStatus !== 0
        ? ["verify-work.sh checks are failing"]
        : verifyWorkScore < 1
          ? ["implementation brief is empty or template-only"]
          : [],
    score: verifyWorkScore,
    detail:
      shellStatus !== 0
        ? "verify-work.sh reported blocking issues"
        : verifyWorkScore < 1
          ? "implementation brief missing"
          : "verify-work.sh checks passed (project tests are not run)"
  });

  const confidenceScore = Math.round(
    stages.reduce((accumulator, stage) => accumulator + weights[stage.name] * stage.score, 0)
  );
  const blocked = stages.some((stage) => stage.blocking);

  return {
    profile,
    scope,
    item,
    stages,
    confidenceScore,
    blocked,
    verdict: blocked ? "BLOCKED" : confidenceScore >= 90 ? "READY" : confidenceScore >= 75 ? "CONDITIONAL" : "WEAK"
  };
}


export { verifyV2 };
