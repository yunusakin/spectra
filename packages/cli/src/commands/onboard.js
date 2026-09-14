import { createInterface } from "node:readline/promises";
import { findSpectraRoot } from "../lib/runtime.js";
import { parseOptions } from "../lib/options.js";
import { ok, title, warn } from "../lib/output.js";
import { readIndex } from "../lib/index/cache.js";
import {
  buildProjectBriefDraft,
  getProjectBriefPath,
  isProjectBriefTemplateOnly,
  resolveOnboardingAnswers
} from "../lib/onboarding.js";
import fs from "node:fs";

const QUESTIONS = [
  ["projectName", "Project name (enter to skip): "],
  ["purpose", "One-sentence purpose (enter to skip): "],
  ["appType", "App type, e.g. REST service / CLI / web app (enter to skip): "],
  ["targetUsers", "Target users (enter to skip): "]
];

async function askOnboardingAnswers() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answers = {};
  try {
    for (const [key, question] of QUESTIONS) {
      answers[key] = (await prompt.question(question)).trim();
    }
  } finally {
    prompt.close();
  }
  return answers;
}

function printRepoIndexSummary(repoIndex) {
  if (!repoIndex) {
    warn("No repo index found yet. Run \"spectra index\" first, then \"spectra onboard\" again.");
    return;
  }
  title(`Detected ecosystems: ${repoIndex.ecosystems.join(", ") || "none"}`);
  title(`Modules known: ${repoIndex.stats.byKind.module ?? 0}`);
}

async function onboardCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--force"],
    stringFlags: ["--cwd"]
  });

  if (options["--help"]) {
    title("Usage: spectra onboard [--force] [--cwd <path>]");
    return 0;
  }

  const cwd = options["--cwd"] ?? process.cwd();
  const repoRoot = findSpectraRoot(cwd);
  if (!repoRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }

  const repoIndex = readIndex(repoRoot);
  const existingHasContent = !isProjectBriefTemplateOnly(repoRoot);

  const answers = await resolveOnboardingAnswers({
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    ask: askOnboardingAnswers,
    existingHasContent,
    force: Boolean(options["--force"])
  });

  if (answers === null) {
    printRepoIndexSummary(repoIndex);
    if (existingHasContent) {
      title("projectbrief.md already has real content, skipping (use --force to overwrite).");
    }
    return 0;
  }

  const draft = buildProjectBriefDraft({ answers, repoIndex });
  fs.writeFileSync(getProjectBriefPath(repoRoot), draft);
  ok("Wrote spectra/sdd/memory-bank/core/projectbrief.md");
  title("Next: spectra context --role planner --goal discover");
  return 0;
}

export { onboardCommand };
