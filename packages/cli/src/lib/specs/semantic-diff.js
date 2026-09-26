import { getChangedFiles } from "../git-diff.js";

const CATEGORY_PRECEDENCE = [
  "scope increase",
  "contract break",
  "behavior change",
  "observability-only",
  "infra-only",
  "copy-only"
];

function classifySemanticCategory(relativePath) {
  if (
    relativePath.endsWith("feature.spec.yaml") ||
    relativePath === "sdd/memory-bank/core/projectbrief.md"
  ) {
    return "scope increase";
  }

  if (relativePath.endsWith("technical-decisions.yaml")) {
    return "contract break";
  }

  if (relativePath.endsWith("ai-behavior-spec.yaml")) {
    return "behavior change";
  }

  if (
    relativePath.endsWith("telemetry-contract.yaml") ||
    relativePath.endsWith("release-thresholds.yaml") ||
    relativePath.endsWith("release-checklist.md") ||
    relativePath.includes("/evals/")
  ) {
    return "observability-only";
  }

  if (
    relativePath.startsWith("app/") ||
    relativePath.startsWith(".github/") ||
    relativePath.startsWith("scripts/") ||
    relativePath.startsWith("packages/")
  ) {
    return "infra-only";
  }

  if (relativePath.endsWith(".md") || relativePath.endsWith(".txt")) {
    return "copy-only";
  }

  return "infra-only";
}

function earliestInvalidatedStage(categories) {
  if (categories.includes("scope increase")) {
    return "draft";
  }
  if (categories.includes("contract break")) {
    return "product-approved";
  }
  if (categories.includes("behavior change")) {
    return "technical-approved";
  }
  if (categories.includes("observability-only") || categories.includes("infra-only")) {
    return "implementation-approved";
  }
  return null;
}

function buildSemanticDiff(repoRoot, { base = null, head = null, includeWorktree = true } = {}) {
  const changedFiles = getChangedFiles(repoRoot, { base, head, includeWorktree });
  const semanticEvents = [];

  for (const relativePath of changedFiles) {
    // Generated governance/eval artifacts are outputs, not changes that should invalidate the approval they record.
    if (relativePath === "sdd/governance/approval-state.yaml" || relativePath.includes("/evals/reports/")) continue;
    if (
      !relativePath.startsWith("sdd/") &&
      !relativePath.startsWith("app/") &&
      !relativePath.startsWith("packages/") &&
      !relativePath.startsWith("scripts/") &&
      !relativePath.startsWith(".github/") &&
      relativePath !== "README.md" &&
      !relativePath.endsWith(".md")
    ) {
      continue;
    }

    semanticEvents.push({
      path: relativePath,
      category: classifySemanticCategory(relativePath)
    });
  }

  const categories = [...new Set(semanticEvents.map((event) => event.category))].sort(
    (left, right) => CATEGORY_PRECEDENCE.indexOf(left) - CATEGORY_PRECEDENCE.indexOf(right)
  );

  return {
    changed_files: changedFiles,
    semantic_events: semanticEvents,
    categories,
    highest_valid_after: earliestInvalidatedStage(categories),
    invalidates: {
      "product-approved": categories.includes("scope increase"),
      "technical-approved": categories.some((category) => ["scope increase", "contract break"].includes(category)),
      "implementation-approved": categories.some((category) =>
        ["scope increase", "contract break", "behavior change"].includes(category)
      ),
      "release-approved": categories.some((category) => category !== "copy-only")
    }
  };
}


export { buildSemanticDiff, classifySemanticCategory, earliestInvalidatedStage };
