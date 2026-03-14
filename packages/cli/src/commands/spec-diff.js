import { findSpectraRoot, runInstalledScript } from "@spectra/core";
import { ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { buildSemanticDiff, computeApprovalState } from "../lib/specs.js";

function specDiffCommand(argv) {
  const mode = argv[0];

  if (!mode || mode === "--help") {
    title("Usage: spectra diff <init|update|semantic> [script options]");
    return 0;
  }

  if (!["init", "update", "semantic"].includes(mode)) {
    throw new Error(`Unsupported spec diff mode: ${mode}`);
  }

  const { options, positional } = parseOptions(argv.slice(1), {
    booleanFlags: ["--help", "--no-worktree", "--patch", "--stdout"],
    stringFlags: ["--cwd", "--report", "--scope", "--base", "--head"]
  });

  if (options["--help"]) {
    title("Usage: spectra diff <init|update|semantic> [--cwd <path>] [--report <path>] [--scope <path>] [--base <ref>] [--head <ref>] [--patch] [--stdout]");
    return 0;
  }

  if (mode === "semantic") {
    const repoRoot = findSpectraRoot(options["--cwd"] ?? process.cwd());
    if (!repoRoot) {
      throw new Error(`Could not find a Spectra runtime from ${options["--cwd"] ?? process.cwd()}`);
    }

    const diff = buildSemanticDiff(repoRoot, {
      base: options["--base"] ?? null,
      head: options["--head"] ?? null,
      includeWorktree: !options["--no-worktree"]
    });
    const approval = computeApprovalState(repoRoot);
    const grouped = diff.semantic_events.reduce((accumulator, event) => {
      accumulator[event.category] = accumulator[event.category] ?? [];
      accumulator[event.category].push(event.path);
      return accumulator;
    }, {});

    title("Spectra Semantic Spec Diff");
    title(`Changed files: ${diff.semantic_events.length}`);
    title(`Categories: ${diff.categories.join(", ") || "none"}`);
    title(`Highest valid approval: ${approval.highest_valid_state}`);
    title("");
    for (const category of diff.categories) {
      const files = grouped[category] ?? [];
      title(`- ${category}: ${files.length} file(s)`);
      for (const filePath of files.slice(0, 5)) {
        title(`  - ${filePath}`);
      }
      if (files.length > 5) {
        title(`  - ... ${files.length - 5} more`);
      }
    }
    if (diff.highest_valid_after) {
      ok(`Highest valid state after diff remains at or above ${diff.highest_valid_after}`);
    }
    return 0;
  }

  const args = [mode === "init" ? "--init" : "--update", ...positional];

  for (const flag of ["--report", "--scope", "--base"]) {
    if (options[flag]) {
      args.push(flag, options[flag]);
    }
  }

  for (const flag of ["--no-worktree", "--patch", "--stdout"]) {
    if (options[flag]) {
      args.push(flag);
    }
  }

  return runInstalledScript({
    cwd: options["--cwd"] ?? process.cwd(),
    scriptName: "spec-diff.sh",
    args
  });
}

export { specDiffCommand };
