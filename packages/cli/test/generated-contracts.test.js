import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cliRoot, createGitProject, initProject, spectra } from "./helpers/project.js";

const repoRoot = path.resolve(cliRoot, "..", "..");
const sourceScripts = path.join(repoRoot, "scripts");
const runtimeScripts = path.join(repoRoot, "packages", "core", "assets", "runtime", "scripts");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

test("generated Full scaffolding teaches canonical vocabulary only", () => {
  const root = initProject("full");
  const problems = [];
  for (const file of walk(path.join(root, ".spectra", "sdd"))) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      if (/verify v2|Spectra Verify v2|spectra validate|context-pack\.sh|discuss-task\.sh|eval run|skills resolve|adapters generate|spec diff\b(?! report)|bash scripts\/|\.\/spectra\/bin/i.test(line)) {
        problems.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(problems, []);
});

test("generated release thresholds only require gates that verify enforces", () => {
  const root = initProject("full");
  const featuresDir = path.join(root, ".spectra", "sdd", "features");
  const thresholdFiles = walk(featuresDir).filter((file) => /kind:\s*"?ReleaseThresholds/.test(fs.readFileSync(file, "utf8")) || /"kind":\s*"ReleaseThresholds"/.test(fs.readFileSync(file, "utf8")));
  assert.ok(thresholdFiles.length > 0);
  for (const file of thresholdFiles) {
    const text = fs.readFileSync(file, "utf8");
    // verify never runs project tests, so the contract must not claim it does.
    assert.doesNotMatch(text, /"?tests"?:\s*\{\s*"?required"?:\s*true/, `${file} requires project tests`);
    assert.match(text, /verify_work/);
  }
  for (const file of walk(featuresDir)) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /aggregate validation, policy, tests,/, `${file} claims tests are aggregated`);
  }
});

// scripts/ is the repository's own copy of the runtime scripts. Anything not
// listed here must stay byte-identical to the packaged runtime; a deliberate
// difference must be added below with its reason.
const INTENTIONAL_DIFFERENCES = {
  "validate-repo.sh": "repository-only validator: includes source-repo smoke tests (agent readiness) that do not apply to consumer runtimes"
};

test("source scripts/ match the packaged runtime except for documented differences", () => {
  const drift = [];
  for (const name of fs.readdirSync(sourceScripts)) {
    const runtimeFile = path.join(runtimeScripts, name);
    if (!fs.existsSync(runtimeFile)) {
      drift.push(`${name}: source-only file (document it or remove it)`);
      continue;
    }
    if (INTENTIONAL_DIFFERENCES[name]) continue;
    if (!fs.readFileSync(path.join(sourceScripts, name)).equals(fs.readFileSync(runtimeFile))) {
      drift.push(`${name}: differs from packaged runtime`);
    }
  }
  assert.deepEqual(drift, []);
});

test("shell scripts distinguish the project root from the data root", () => {
  const runtime = fs.readFileSync(path.join(runtimeScripts, "_runtime.sh"), "utf8");
  assert.match(runtime, /SPECTRA_DATA_ROOT/);
  assert.match(runtime, /SPECTRA_PROJECT_ROOT/);
  const specDiff = fs.readFileSync(path.join(runtimeScripts, "spec-diff.sh"), "utf8");
  assert.doesNotMatch(specDiff, /-d "\.git"/, "spec-diff must not assume the data root is the Git root");
});

test("agent adapter files are regenerable projections of .spectra state", () => {
  const root = initProject("full");
  // codex is left out on purpose: it needs the codex CLI on PATH, which the
  // projection contract does not depend on.
  const files = ["CLAUDE.md", ".github/copilot-instructions.md", ".cursor/rules"].map((f) => path.join(root, f));
  const generate = () => spectra(root, ["adapters", "--agents", "claude,copilot,cursor"]);
  assert.equal(generate().status, 0);
  const snapshot = (file) => (fs.statSync(file).isDirectory() ? walk(file).map((f) => fs.readFileSync(f, "utf8")).join("\n") : fs.readFileSync(file, "utf8"));
  const before = files.map(snapshot);
  for (const file of files) fs.rmSync(file, { recursive: true, force: true });
  assert.equal(generate().status, 0);
  assert.deepEqual(files.map(snapshot), before);
});

test("Full Codex adapter directs state updates into canonical .spectra files", () => {
  const root = initProject("full");
  const generated = spectra(root, ["adapters", "--agents", "codex"], { SPECTRA_CODEX_COMMAND: "git" });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);

  const instructions = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const statePaths = [...instructions.matchAll(/`([^`]*(?:activeContext|progress)\.md)`/g)].map((match) => match[1]);
  assert.deepEqual(statePaths, [
    ".spectra/sdd/memory-bank/core/activeContext.md",
    ".spectra/sdd/memory-bank/core/progress.md"
  ]);
  assert.match(instructions, /project state in `\.spectra\/sdd\/memory-bank\/`/);
  for (const relativePath of statePaths) {
    fs.appendFileSync(path.join(root, relativePath), "\nCodex adapter E2E marker\n");
    assert.match(fs.readFileSync(path.join(root, relativePath), "utf8"), /Codex adapter E2E marker/);
  }
  assert.equal(fs.existsSync(path.join(root, "sdd")), false);
});

test("adapters refuse to overwrite user-owned files unless forced; doctor --fix never does", () => {
  const root = initProject("full");
  const claude = path.join(root, "CLAUDE.md");
  fs.writeFileSync(claude, "# my own notes\n");

  const refused = spectra(root, ["adapters", "--agents", "claude"]);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr + refused.stdout, /Refusing to overwrite/);
  assert.equal(fs.readFileSync(claude, "utf8"), "# my own notes\n");

  const fixed = spectra(root, ["doctor", "--fix"]);
  assert.equal(fs.readFileSync(claude, "utf8"), "# my own notes\n", `doctor --fix overwrote CLAUDE.md: ${fixed.stdout}`);

  assert.equal(spectra(root, ["adapters", "--agents", "claude", "--force"]).status, 0);
  assert.match(fs.readFileSync(claude, "utf8"), /^# Spectra Core Instructions/);
});

test("init --agents refuses to overwrite an existing user-owned adapter file before installing anything", () => {
  const root = createGitProject();
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "# my own notes\n");
  const result = spectra(root, ["init", ".", "--profile", "full", "--agents", "claude"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Refusing to overwrite/);
  assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), "# my own notes\n");
  assert.equal(fs.existsSync(path.join(root, ".spectra")), false, "nothing may be installed when the request is refused");
});

test("spectra check does not misreport listed prompts when the prompts index is very large", () => {
  // The validators pipe the index into `grep -q` under `set -o pipefail`. grep exits
  // on the first match, so a large index makes the writer die of SIGPIPE and the
  // pipeline fail even though the prompt IS listed.
  const root = initProject("full");
  const index = path.join(root, ".spectra", "sdd", "system", "prompts", "index.md");
  const padding = Array.from({ length: 9000 }, (_, i) => `- \`zzz/padding-entry-${String(i).padStart(5, "0")}-xxxxxxxxxxxxxxxx.md\``);
  fs.appendFileSync(index, `\n${padding.join("\n")}\n`);

  const result = spectra(root, ["check"]);
  assert.doesNotMatch(result.stdout + result.stderr, /not listed in prompts index/);
});
