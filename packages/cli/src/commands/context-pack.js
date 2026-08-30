import fs from "node:fs";
import path from "node:path";
import { buildContextPack, estimateTokensFromFile } from "../lib/context.js";
import { buildRoute } from "../lib/business-context.js";
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

function recomputeTotals(entries) {
  return entries.reduce(
    (accumulator, entry) => {
      accumulator.estimatedTokens += entry.estimatedTokens;
      accumulator[entry.mode] += entry.estimatedTokens;
      return accumulator;
    },
    { estimatedTokens: 0, summary: 0, full: 0 }
  );
}

function contextPackCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--changed"],
    stringFlags: ["--base", "--cwd", "--domain", "--format", "--goal", "--head", "--module", "--role", "--route-task", "--task"]
  });

  if (options["--help"]) {
    title("Usage: spectra context [--role <role>] [--goal <goal>] [--task <legacy_pack>] [--route-task <task>] [--domain <domain>] [--module <module>] [--cwd <path>] [--format <refs|inline|json>] [--changed|--base <ref> --head <ref>]");
    return 0;
  }

  const hasRoleGoal = Boolean(options["--role"] && options["--goal"]);
  const hasRouteTask = Boolean(options["--route-task"]);
  if (!options["--task"] && !hasRoleGoal && !hasRouteTask) {
    throw new Error("Provide either --task <legacy_pack> or both --role and --goal.");
  }

  const pack = buildContextPack({
    cwd: options["--cwd"] ?? process.cwd(),
    role: options["--role"] ?? (hasRouteTask ? "implementer" : null),
    goal: options["--goal"] ?? (hasRouteTask ? "implement" : null),
    task: options["--task"] ?? null,
    changed: Boolean(options["--changed"]),
    base: options["--base"] ?? null,
    head: options["--head"] ?? null
  });
  if (options["--route-task"]) {
    const route = buildRoute({
      cwd: options["--cwd"] ?? process.cwd(),
      task: options["--route-task"],
      domains: String(options["--domain"] ?? "").split(",").filter(Boolean),
      modules: String(options["--module"] ?? "").split(",").filter(Boolean)
    });
    pack.route = route;
    const existingPaths = new Set(pack.entries.map((entry) => entry.path));
    for (const entry of route.entries) {
      if (existingPaths.has(entry.path)) continue;
      const absolutePath = path.join(route.repoRoot, entry.path);
      pack.entries.push({
        ...entry,
        absolutePath,
        exists: fs.existsSync(absolutePath),
        changed: false,
        changedRefs: [],
        estimatedTokens: estimateTokensFromFile(absolutePath),
        source: "route"
      });
      existingPaths.add(entry.path);
    }
    pack.avoid = [...new Set([...pack.avoid, ...route.deferred])].filter((candidate) => !existingPaths.has(candidate));
    pack.totals = recomputeTotals(pack.entries);
  }

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
