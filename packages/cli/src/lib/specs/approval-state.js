import fs from "node:fs";
import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { isGitRepo } from "../git-diff.js";
import { STAGES, stageOrder } from "./stages.js";
import { buildSemanticDiff } from "./semantic-diff.js";
import { hasRealMarkdownContent, readJsonContract, writeJsonContract } from "./primitives.js";

const STAGE_INVALIDATION = {
  "product-approved": new Set(["scope increase"]),
  "technical-approved": new Set(["scope increase", "contract break"]),
  "implementation-approved": new Set(["scope increase", "contract break", "behavior change"]),
  "release-approved": new Set([
    "scope increase",
    "contract break",
    "behavior change",
    "observability-only",
    "infra-only"
  ])
};

function loadApprovalState(repoRoot) {
  const approvalStatePath = path.join(getSddRoot(repoRoot), "governance", "approval-state.yaml");
  const state = readJsonContract(approvalStatePath, null);
  if (!state) {
    throw new Error(`Missing approval state at ${approvalStatePath}`);
  }
  return { path: approvalStatePath, state };
}

function stageIsValid(stage, categories) {
  const invalidating = STAGE_INVALIDATION[stage];
  if (!invalidating) {
    return true;
  }
  return !categories.some((category) => invalidating.has(category));
}


function syncLegacyApprovalStatus(repoRoot, stage) {
  const stateFile = path.join(getSddRoot(repoRoot), "memory-bank", "core", "intake-state.md");
  if (!fs.existsSync(stateFile)) {
    return;
  }

  const nextStatus = stage === "draft" ? "not approved" : stage;
  const lines = fs.readFileSync(stateFile, "utf8").replace(/(?:\r?\n)+$/, "").split(/\r?\n/);
  let inComment = false;
  let inApprovalSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes("<!--")) {
      inComment = true;
    }
    if (!inComment && /^##\s+Approval Status\s*$/.test(line.trim())) {
      inApprovalSection = true;
      continue;
    }
    if (inApprovalSection) {
      if (/^##\s+/.test(line.trim())) {
        break;
      }
      if (line.trim() === "" || line.trim().startsWith("<!--")) {
        continue;
      }
      lines[index] = nextStatus;
      break;
    }
    if (line.includes("-->")) {
      inComment = false;
    }
  }

  fs.writeFileSync(stateFile, `${lines.join("\n")}\n`);
}

function computeApprovalState(repoRoot) {
  const { path: approvalPath, state } = loadApprovalState(repoRoot);

  if (!isGitRepo(repoRoot)) {
    const nextState = {
      ...state,
      highest_valid_state: state.current_state ?? state.highest_valid_state ?? "draft",
      invalidations: []
    };
    writeJsonContract(approvalPath, nextState);
    syncLegacyApprovalStatus(repoRoot, nextState.current_state ?? "draft");
    return nextState;
  }

  const invalidations = [];
  let highestValid = "draft";

  for (const stage of STAGES.slice(1)) {
    const baseline = state?.stages?.[stage]?.baseline_commit;
    if (!baseline) {
      break;
    }

    const diff = buildSemanticDiff(repoRoot, { base: baseline, head: "HEAD", includeWorktree: true });
    if (!stageIsValid(stage, diff.categories)) {
      invalidations.push({
        stage,
        categories: diff.categories,
        since: baseline
      });
      break;
    }

    highestValid = stage;
  }

  const nextState = {
    ...state,
    highest_valid_state: highestValid,
    invalidations
  };

  writeJsonContract(approvalPath, nextState);
  syncLegacyApprovalStatus(repoRoot, nextState.highest_valid_state ?? "draft");
  return nextState;
}

function ensureStageAllowed(stage) {
  if (!STAGES.includes(stage) || stage === "draft") {
    throw new Error(`Unsupported stage: ${stage}`);
  }
}


export { computeApprovalState, ensureStageAllowed, loadApprovalState, stageIsValid, syncLegacyApprovalStatus };
