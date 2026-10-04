#!/usr/bin/env node
// Phase 1F — read-only role/goal budget matrix over `spectra context --route-task --format json`.
// Usage: node test/evaluation/budget-matrix.mjs [--fresh] [--write <file>]
// `--fresh` measures a newly initialized project instead of this repository. Only derived cache
// files are written (by `spectra context` / `spectra index`); canonical knowledge is never touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCorpus } from "./runner.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, "..", "..");
const repoRoot = path.resolve(cliRoot, "..", "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");
const MATRIX = [["planner", "discover"], ["planner", "decide"], ["architect", "decide"], ["implementer", "implement"], ["reviewer", "verify"], ["verifier", "verify"], ["release-manager", "ship"]];
const MATRIX_TASK = "Block AI-assisted implementation until implementation approval is granted.";
const DOGFOOD = ["spectra-approval-gating", "spectra-lifecycle", "spectra-repo-index", "spectra-context-resolver"];

const spectra = (cwd, args) => spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const idOf = (entry) => entry.knowledgeId ?? entry.id ?? entry.path;

function measure(cwd, role, goal, task, labels = null, modules = []) {
  const run = spectra(cwd, ["context", "--role", role, "--goal", goal, "--route-task", task, "--format", "json", ...modules.flatMap((name) => ["--module", name])]);
  if (run.status !== 0) throw new Error(`context failed: ${run.stderr || run.stdout}`);
  const pack = JSON.parse(run.stdout);
  const { selection } = pack;
  const modeOf = new Map(pack.entries.map((entry) => [idOf(entry), entry.mode === "summary" ? "summary" : "markdown"]));
  const mandatory = selection.included.filter((entry) => entry.required);
  const optionalIncluded = selection.included.filter((entry) => !entry.required);
  const result = {
    markdownBudget: selection.full.budget,
    summaryBudget: selection.summary.budget,
    mandatoryFull: selection.mandatory.full,
    mandatorySummary: selection.mandatory.summary,
    markdownHeadroom: selection.full.budget - selection.mandatory.full,
    summaryHeadroom: selection.summary.budget - selection.mandatory.summary,
    status: selection.status,
    mandatoryEntries: mandatory.map((entry) => ({ id: entry.id, pool: modeOf.get(entry.id) ?? "markdown", tokens: entry.estimatedTokens })),
    optionalCandidateTokens: optionalIncluded.reduce((sum, entry) => sum + entry.estimatedTokens, 0) + selection.excluded.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
    optionalIncludedTokens: optionalIncluded.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
    optionalExcludedTokens: selection.excluded.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
    packTotal: pack.totals.estimatedTokens,
    candidateIds: [...optionalIncluded.map((entry) => entry.id), ...selection.excluded.map((entry) => entry.id)].sort()
  };
  if (labels) {
    const good = new Set([...(labels.required ?? []), ...(labels.relevant ?? [])]);
    const sum = (list) => list.filter((entry) => good.has(entry.id)).reduce((total, entry) => total + entry.estimatedTokens, 0);
    result.relevant = {
      requestedTokens: sum(optionalIncluded) + sum(selection.excluded),
      includedTokens: sum(optionalIncluded),
      excludedTokens: sum(selection.excluded),
      includedIds: optionalIncluded.filter((entry) => good.has(entry.id)).map((entry) => entry.id).sort(),
      excludedIds: selection.excluded.filter((entry) => good.has(entry.id)).map((entry) => entry.id).sort()
    };
  }
  return result;
}

function freshProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-budget-fresh-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  const init = spectra(root, ["init", "."]);
  if (init.status !== 0) throw new Error(init.stderr || init.stdout);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fresh", private: true }));
  spectra(root, ["index"]);
  return root;
}

const fresh = process.argv.includes("--fresh");
const cwd = fresh ? freshProject() : repoRoot;
const corpus = loadCorpus();
const out = { repository: fresh ? "fresh-init" : "spectra", roles: {}, dogfood: {} };
for (const [role, goal] of MATRIX) out.roles[`${role}/${goal}`] = measure(cwd, role, goal, MATRIX_TASK);
for (const id of fresh ? [] : DOGFOOD) {
  const entry = corpus.cases.find((candidate) => candidate.id === id);
  out.dogfood[id] = measure(cwd, "implementer", "implement", entry.task, entry.expect ?? {}, entry.modules ?? []);
}
const text = `${JSON.stringify(out, null, 2)}\n`;
const target = process.argv.indexOf("--write");
if (target > 0) fs.writeFileSync(process.argv[target + 1], text);
else process.stdout.write(text);
