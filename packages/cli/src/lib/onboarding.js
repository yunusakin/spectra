import path from "node:path";
import { getSddRoot } from "./project-layout.js";
import { hasRealMarkdownContent } from "./specs.js";

const MAX_DETECTED_MODULES = 10;

function getProjectBriefPath(repoRoot) {
  return path.join(getSddRoot(repoRoot), "memory-bank", "core", "projectbrief.md");
}

function isProjectBriefTemplateOnly(repoRoot) {
  return !hasRealMarkdownContent(getProjectBriefPath(repoRoot));
}

function renderDetectedStackSection(repoIndex) {
  if (!repoIndex) {
    return "";
  }
  const modules = (repoIndex.records ?? []).filter((record) => record.kind === "module").slice(0, MAX_DETECTED_MODULES);
  const ecosystemLine = `- Ecosystems: ${repoIndex.ecosystems?.join(", ") || "none detected"}`;
  const moduleLines = modules.map(
    (m) => `- ${m.name} (${m.path ?? "."}) — ${m.ecosystem}, ${m.confidence}/${m.status}`
  );

  return [
    "",
    "### Detected Stack (from `spectra index`)",
    "> Technical facts read from the repo index, not inferred business intent. Run `spectra index --explain` for full evidence.",
    "",
    ecosystemLine,
    ...moduleLines
  ].join("\n");
}

function section(heading, value, fallbackBody, extra = "") {
  const body = value && value.trim() ? value.trim() : fallbackBody;
  return `## ${heading}\n${body}${extra}\n`;
}

// Pure render function: given optional user answers and an optional repo
// index, produces the projectbrief.md content. Headings must match exactly
// what lib/context.js's parseProjectSummary expects, so this stays a drop-in
// replacement for the shipped "Filled by intake" template rather than a
// parallel format.
function buildProjectBriefDraft({ answers = {}, repoIndex = null } = {}) {
  const parts = [
    "# Project Brief",
    "",
    "> Filled by intake.",
    "",
    section("Project Name", answers.projectName, "<!-- Filled by intake -->"),
    "",
    section("Purpose", answers.purpose, "<!-- Filled by intake -->"),
    "",
    section("App Type", answers.appType, "<!-- Filled by intake -->"),
    "",
    section(
      "Product Context",
      answers.targetUsers || answers.mainUseCases
        ? [answers.targetUsers && `- Target users: ${answers.targetUsers}`, answers.mainUseCases && `- Main use cases: ${answers.mainUseCases}`]
            .filter(Boolean)
            .join("\n")
        : "",
      "> Filled by intake."
    ),
    "",
    section("Requirements", "", "> Filled by intake."),
    "",
    section("Constraints", "", "> Filled by intake.", renderDetectedStackSection(repoIndex))
  ];

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// Decision logic only — mirrors resolveGitMode in git-policy.js. Kept
// separate from the real readline wiring in commands/onboard.js so it is
// directly unit-testable with an injected `ask`.
async function resolveOnboardingAnswers({ isTTY = false, ask, existingHasContent = false, force = false } = {}) {
  if (!isTTY) {
    return null;
  }
  if (existingHasContent && !force) {
    return null;
  }
  if (typeof ask !== "function") {
    return null;
  }
  return ask();
}

export { buildProjectBriefDraft, getProjectBriefPath, isProjectBriefTemplateOnly, resolveOnboardingAnswers };
