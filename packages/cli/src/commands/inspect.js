import fs from "node:fs";
import path from "node:path";
import { parseOptions } from "../lib/options.js";
import { findSpectraRoot } from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { assertRefsResolve, getChangedFiles, isGitRepo, toDataRelative } from "../lib/git-diff.js";
import { analyzeImpact, inspectSubject } from "../lib/project-intelligence.js";

const USAGE = "Usage: spectra inspect <id> [--json] | spectra inspect --changed | --base <ref> [--head <ref>] | --file <path>[,<path>...] [--json] [--cwd <path>]";

const list = (items) => (items.length > 0 ? items.map((item) => item.id).join(", ") : "none");

function printSubject(result) {
  const { subject, relationships, modules, verification, gate, warnings } = result;
  title(`${subject.id} [${subject.kind}${subject.status ? `, ${subject.status}` : ""}]${subject.source ? ` ${subject.source}` : ""}`);
  for (const [name, items] of Object.entries(relationships)) title(`  ${name}: ${list(items)}`);
  if (modules.length > 0) title(`  modules: ${modules.map((module) => `${module.id} (tests: ${module.testTargets.map((target) => target.id).join(", ") || "none"})`).join("; ")}`);
  if (verification.state) {
    title(`Verification: ${verification.state} (${verification.reason})`);
    for (const scope of verification.scopes) title(`  - ${scope.subject} via ${scope.target}: ${!scope.result ? "no evidence" : scope.fresh ? `fresh ${scope.result}` : `stale ${scope.result}`}`);
    for (const gap of verification.gaps) title(`  - ${gap}`);
  } else {
    title("Verification:");
    for (const entry of verification.rules ?? verification.subjects) title(`  - ${entry.id}: ${entry.state}`);
    if (verification.evidence) title(`  evidence: ${verification.evidence.fresh ? "fresh" : "stale"} ${verification.evidence.result}${verification.evidence.staleBecause.length > 0 ? ` (${verification.evidence.staleBecause.join(", ")} changed)` : ""}`);
    else if (verification.evidence === null) title("  evidence: none recorded");
  }
  for (const stage of ["review", "release"]) {
    title(`${stage[0].toUpperCase()}${stage.slice(1)} gate: ${gate[stage].status} [${gate.rules.length} rule(s): ${gate.rules.join(", ") || "none"}]`);
    // One line per code/scope/action: the same scope usually blocks several subject/rule pairs. --json keeps them all.
    for (const line of new Set(gate[stage].blockers.map((blocker) => `  BLOCKER ${blocker.code}${blocker.scope ? ` via ${blocker.scope}` : ""}: ${blocker.action}`))) title(line);
  }
  for (const warning of warnings) title(`  warning ${warning.code}: ${warning.reason}`);
}

function printImpact(result) {
  const scope = result.scope.kind === "range" ? `range ${result.scope.base}..${result.scope.head}` : result.scope.kind;
  if (result.outcome === "no-changed-files") {
    title(`No changed files (${scope}): nothing is impacted.`);
    for (const warning of result.warnings) title(`  warning ${warning.code}: ${warning.reason}`);
    return;
  }
  title(`Impact of ${result.files.length} changed file(s) (${scope}): ${result.outcome}`);
  for (const file of result.files) title(`  file ${file.path} -> ${file.module ?? "no module"}`);
  for (const rule of result.rules) title(`  rule ${rule.id} (${rule.direct ? "direct" : "via module"}): ${rule.reasons.join(", ")}`);
  for (const subject of result.canonicalSubjects) title(`  subject ${subject.id} (${subject.direct ? "direct" : "related"}): ${subject.reasons.join(", ")}`);
  for (const target of result.verificationScopes) title(`  scope ${target.id} (${target.explicit ? "required" : "related"}): ${target.reasons.join(", ")}`);
  for (const entry of result.verificationState) title(`  ${entry.id}: ${entry.state}`);
  title(`Review gate for these rules: ${result.reviewImpact.status} (${result.reviewImpact.blockers.length} blocker(s))`);
  title(`Release gate: ${result.releaseImpact.status} (${result.releaseImpact.blockersInScope.length} of ${result.releaseImpact.projectBlockers} project blocker(s) concern these rules)`);
  for (const warning of result.warnings) title(`  warning ${warning.code}: ${warning.reason}`);
}

function inspectCommand(argv) {
  const { options, positional } = parseOptions(argv, {
    booleanFlags: ["--help", "--json", "--changed"],
    stringFlags: ["--cwd", "--file", "--base", "--head"]
  });
  if (options["--help"]) {
    title(USAGE);
    title("  Read-only. Explains one stable ID (rule, requirement, scenario, invariant, module or test target) or the impact of changed files; never runs tests or writes project files.");
    return 0;
  }
  const cwd = options["--cwd"] ?? process.cwd();
  const selectors = [options["--changed"], options["--base"], options["--file"]].filter(Boolean).length;
  if (positional.length > 1 || (positional.length === 1 && selectors > 0) || selectors > 1 || (positional.length === 0 && selectors === 0)) throw new Error(USAGE);
  if (options["--head"] && !options["--base"]) throw new Error("--head needs --base: it names the end of the compared range.");
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  const emit = (result) => title(JSON.stringify(result, null, 2));

  if (positional.length === 1) {
    const result = inspectSubject(projectRoot, positional[0]);
    if (!result.found) {
      throw new Error(result.kind
        ? `${positional[0]} is a Repo Index ${result.kind}, not an inspectable subject (expected a business rule, requirement, scenario, invariant, module or test-target ID)`
        : `Unknown subject: ${positional[0]} (expected a business rule, requirement, scenario, invariant, Repo Index module or test-target ID)`);
    }
    if (options["--json"]) emit(result);
    else printSubject(result);
    return 0;
  }

  let files;
  let scope;
  if (options["--file"]) {
    // Resolved against the working directory (like any CLI path) and compared by real path, so a symlinked
    // root or a call from a subdirectory names the file it points at.
    const real = (target) => { try { return fs.realpathSync(target); } catch { return path.resolve(target); } };
    const rootReal = real(projectRoot);
    files = options["--file"].split(",").filter(Boolean).map((file) => {
      const absolute = path.resolve(cwd, file);
      const relative = path.relative(rootReal, path.join(real(path.dirname(absolute)), path.basename(absolute)));
      if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`File is outside the project: ${file}`);
      return toDataRelative(relative.split(path.sep).join("/"));
    });
    files = [...new Set(files)].sort();
    scope = { kind: "files" };
  } else {
    if (!isGitRepo(projectRoot)) throw new Error("This is not a git repository, so changed files cannot be determined; name them with --file.");
    assertRefsResolve(projectRoot, [options["--base"], options["--head"]]);
    files = getChangedFiles(projectRoot, { base: options["--base"], head: options["--head"] });
    scope = options["--base"] ? { kind: "range", base: options["--base"], head: options["--head"] ?? "HEAD" } : { kind: "changed" };
  }
  const result = analyzeImpact(projectRoot, files, scope);
  if (options["--json"]) emit(result);
  else printImpact(result);
  return 0;
}

export { inspectCommand };
