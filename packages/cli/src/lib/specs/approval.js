import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { getCurrentCommit, isGitRepo } from "../git-diff.js";
import { stageOrder } from "./stages.js";
import { computeApprovalState, loadApprovalState, syncLegacyApprovalStatus, ensureStageAllowed, stageIsValid } from "./approval-state.js";
import { buildSemanticDiff } from "./semantic-diff.js";
import { validateSpectraV2 } from "./validation.js";
import { verifyV2 } from "./verification.js";
import { hasRealMarkdownContent, writeJsonContract } from "./primitives.js";

// `shellStatus` is the exit status of verify-work.sh, run by the caller (see
// lib/verify-runner.js) so release approval enforces the same checks as
// `spectra verify --profile release`.
function approveStage(repoRoot, stage, { shellStatus } = {}) {
  ensureStageAllowed(stage);

  const validation = validateSpectraV2(repoRoot);
  if (!validation.ok) {
    throw new Error(`Cannot approve ${stage}: v2 validation has ${validation.errors.length} error(s).`);
  }

  const currentComputed = computeApprovalState(repoRoot);
  const currentHighest = currentComputed.highest_valid_state;
  const currentIndex = stageOrder(currentHighest);
  const targetIndex = stageOrder(stage);

  if (targetIndex > currentIndex + 1) {
    throw new Error(`Cannot skip stages. Highest valid stage is ${currentHighest}.`);
  }

  if (stage === "product-approved" && !hasRealMarkdownContent(path.join(getSddRoot(repoRoot), "memory-bank", "core", "projectbrief.md"))) {
    throw new Error("Cannot approve product stage: projectbrief.md is still template-only.");
  }

  if (stage === "release-approved") {
    if (shellStatus === undefined) {
      throw new Error("Cannot approve release stage: verify-work.sh status is required.");
    }
    const releaseReport = verifyV2(repoRoot, { scope: "all", profile: "release", shellStatus });
    if (releaseReport.blocked) {
      throw new Error(`Cannot approve release stage: verify --profile release is ${releaseReport.verdict}.`);
    }
  }

  const { path: approvalPath, state } = loadApprovalState(repoRoot);
  const commit = getCurrentCommit(repoRoot);
  const worktreeDiff = isGitRepo(repoRoot)
    ? buildSemanticDiff(repoRoot, { base: commit, head: "HEAD", includeWorktree: true })
    : null;
  if (worktreeDiff && !stageIsValid(stage, worktreeDiff.categories)) {
    throw new Error(`Cannot approve ${stage}: uncommitted changes would immediately invalidate it; commit changes and retry.`);
  }
  const dirty = (worktreeDiff?.changed_files.length ?? 0) > 0;

  state.current_state = stage;
  state.highest_valid_state = stage;
  state.stages[stage] = {
    approved_at: new Date().toISOString(),
    baseline_commit: commit,
    dirty
  };
  state.invalidations = [];
  writeJsonContract(approvalPath, state);
  syncLegacyApprovalStatus(repoRoot, stage);
  return state;
}


export { approveStage };
