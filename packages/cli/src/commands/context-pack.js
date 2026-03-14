import fs from "node:fs";
import { buildContextPack } from "../lib/context.js";
import { next, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function printRefs(pack) {
  title("Spectra Context Pack");
  title(`Role: ${pack.role}`);
  title(`Goal: ${pack.goal}`);
  if (pack.task) {
    title(`Legacy Task Alias: ${pack.task}`);
  }
  title(`Estimated Tokens: ${pack.totals.estimatedTokens} (summary=${pack.totals.summary}, full=${pack.totals.full})`);
  title("");
  title("Included:");
  for (const entry of pack.entries) {
    const changeTag = entry.changed ? ", changed" : "";
    const existsTag = entry.exists ? "" : ", missing";
    title(`- ${entry.path} [${entry.mode}${changeTag}${existsTag}]`);
  }
  if (pack.changedFiles.length > 0) {
    title("");
    title("Changed Files Considered:");
    for (const changedFile of pack.changedFiles) {
      title(`- ${changedFile}`);
    }
  }
  title("");
  title("Deferred By Policy:");
  for (const deferred of pack.avoid) {
    title(`- ${deferred}`);
  }
  title("");
  title("Escalate To If Ambiguous:");
  for (const escalationPath of pack.escalation) {
    title(`- ${escalationPath}`);
  }
}

function printInline(pack) {
  title("Spectra Context Pack");
  title(`Role: ${pack.role}`);
  title(`Goal: ${pack.goal}`);
  title("");

  for (const entry of pack.entries) {
    if (!entry.exists) {
      warn(`${entry.path} is missing`);
      continue;
    }

    title(`--- ${entry.path} [${entry.mode}] ---`);
    if (entry.mode === "summary") {
      title(fs.readFileSync(entry.absolutePath, "utf8").trim());
    } else {
      title(`REF ${entry.path}`);
    }
    title("");
  }
}

function contextPackCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--changed"],
    stringFlags: ["--base", "--cwd", "--format", "--goal", "--head", "--role", "--task"]
  });

  if (options["--help"]) {
    title("Usage: spectra ctx [--role <role>] [--goal <goal>] [--task <legacy_pack>] [--cwd <path>] [--format <refs|inline|json>] [--changed|--base <ref> --head <ref>]");
    return 0;
  }

  if (!options["--task"] && !(options["--role"] && options["--goal"])) {
    throw new Error("Provide either --task <legacy_pack> or both --role and --goal.");
  }

  const pack = buildContextPack({
    cwd: options["--cwd"] ?? process.cwd(),
    role: options["--role"] ?? null,
    goal: options["--goal"] ?? null,
    task: options["--task"] ?? null,
    changed: Boolean(options["--changed"]),
    base: options["--base"] ?? null,
    head: options["--head"] ?? null
  });

  switch (options["--format"] ?? "refs") {
    case "refs":
      printRefs(pack);
      break;
    case "inline":
      printInline(pack);
      break;
    case "json":
      title(JSON.stringify(pack, null, 2));
      return 0;
    default:
      throw new Error("Unsupported format. Use refs, inline, or json.");
  }

  if (pack.totals.summary > pack.budgets.summaryTokens) {
    warn(`Summary budget exceeded: ${pack.totals.summary} > ${pack.budgets.summaryTokens}`);
  } else {
    ok(`Summary budget respected (${pack.totals.summary}/${pack.budgets.summaryTokens})`);
  }

  if (pack.totals.full > pack.budgets.markdownTokens) {
    warn(`Markdown budget exceeded: ${pack.totals.full} > ${pack.budgets.markdownTokens}`);
  } else {
    ok(`Markdown budget respected (${pack.totals.full}/${pack.budgets.markdownTokens})`);
  }

  next(`Use summary files first; escalate to ${pack.escalation.length} raw file(s) only if ambiguity remains.`);
  return 0;
}

export { contextPackCommand };
