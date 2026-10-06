// Real-world closure (dogfood findings C1-C7). Failure modes recorded before any product change:
//  C1a  re-adopt rewrites business/INDEX.md to the empty template (domain rows, keywords, modules lost)
//  C1b  re-adopt rewrites tech/modules.md and so loses reviewed module rows that Affected Modules resolve through
//  C1c  re-adopt resurrects a starter feature the user deleted, and overwrites feature bundles / governance state
//  C1d  re-adopt leaves check red or makes pre-existing rule IDs unresolvable
//  C2a  Spectra's own writes (caches, reports, evidence, approval bookkeeping, progress notes) stale test evidence
//  C2b  the fix hides real changes: application source, test source or canonical spec/rule edits no longer stale
//  C3a  shared mode lets disposable caches and eval reports show up as ordinary Git changes
//  C3b  `inspect --changed` reports Spectra's own derived files as product impact
//  C3c  local mode regresses (Spectra state must stay out of Git tracking)
//  C4a  `check` is silent about an Affected Modules entry that cannot resolve although the gates block on it
//  C4b  the warning and the gate blocker describe different problems
//  C5a  `knowledge add` into a domain without routing keywords stays silent and the rule is undiscoverable
//  C5b  the guidance nags when the metadata is already sufficient
//  C6a  onboard reports success while `check` predictably fails, with no hint what is missing
//  C6b  the onboard diagnosis differs from what `check` reports
//  C7a  the unmodified starter feature counts as a consumer product match in adoption gap analysis
//  C7b  the unmodified starter's release checklist blocks a consumer's release readiness
//  C7c  a starter the user has edited, or a real feature, is wrongly ignored
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createGitProject, git, spectra } from "./helpers/project.js";

const sdd = root => path.join(root, ".spectra", "sdd");
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = file => fs.readFileSync(file, "utf8");
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const ok = (root, args) => { const r = spectra(root, args); assert.equal(r.status, 0, `${args.join(" ")}: ${r.stdout}${r.stderr}`); return r; };
const json = (root, args) => JSON.parse(ok(root, args).stdout);
const status = (root, args) => spectra(root, args).status;

const STARTER = "spectra-core";
const TARGET = "node:test-target:.:test:a";

function appProject(mode) {
  const root = createGitProject();
  write(path.join(root, "package.json"), JSON.stringify({ name: "company-project", version: "1.0.0", scripts: { test: "node --test", "test:a": "node --test test/a.test.js" } }, null, 2));
  write(path.join(root, "src/a.js"), "module.exports = { add: (a, b) => a + b };\n");
  write(path.join(root, "test/a.test.js"), "const t = require('node:test'); const assert = require('node:assert'); const { add } = require('../src/a');\nt('add', () => assert.strictEqual(add(1, 2), 3));\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "app");
  return root;
}

function installed(root, mode, adopt = false) {
  ok(root, [adopt ? "adopt" : "init", ".", "--git-mode", mode]);
  return root;
}

// Minimal valid brief and bookkeeping so `check` is green; this is what a user ends up with after real work.
function completeProject(root) {
  write(path.join(sdd(root), "memory-bank/core/projectbrief.md"), "# Project Brief\n\n## Project Name\nCompany Project\n\n## Purpose\nAdd numbers reliably\n\n## App Type\nNode library\n\n## Product Context\n- Target users: engineers\n\n## Requirements\nAddition is exact.\n\n## Constraints\nNo dependencies.\n");
  write(path.join(sdd(root), "memory-bank/core/activeContext.md"), "# Active Context\n\n## Project Binding\n- Project Name: company-project\n\n## Current Focus\n- Current Phase: planning\n- Current Objective: govern addition\n\n## State Snapshot\n- Approval Status: not approved\n\n## Next Actions\n1. Verify.\n\n## Session Boundary\n- Last Updated: today\n- Resume From: verify\n");
  write(path.join(sdd(root), "memory-bank/core/progress.md"), "# Progress\n\n## Project Binding\n- Project Name: company-project\n\n## Progress Summary\n- Overall Status: on-track\n\n## Work Log\n| Date | Item | Status |\n|------|------|--------|\n| today | start | done |\n\n## Next Actions\n1. Verify.\n\n## Session Boundary\n- Last Updated: today\n");
}

// A real feature bundle next to a real rule, the way a user would add them. The starter keeps being the template for
// the other contract files; only the feature spec and the checklist are replaced.
function addGovernedFeature(root, { keep = false } = {}) {
  const features = path.join(sdd(root), "features");
  const starter = path.join(features, STARTER);
  fs.cpSync(starter, path.join(features, "ledger"), { recursive: true });
  const dir = path.join(features, "ledger");
  for (const file of fs.readdirSync(dir, { recursive: true })) {
    const full = path.join(dir, String(file));
    if (fs.statSync(full).isFile()) write(full, read(full).replaceAll(STARTER, "ledger"));
  }
  write(path.join(dir, "feature.spec.yaml"), `apiVersion: spectra/v2
kind: FeatureSpec
metadata:
  id: ledger
  name: Ledger
  version: 0.1.0
  owner: product
  status: draft
summary:
  problem: Sums must be exact.
  outcome: Addition is exact.
scope:
  in:
    - addition
  out:
    - subtraction
requirements:
  functional:
    - id: FR-1
      statement: Adding two integers returns their exact sum.
      priority: must
      verifiedBy:
        - ${TARGET}
    - id: FR-2
      statement: Adding a non-integer is rejected.
      priority: must
  nonFunctional:
    - id: NFR-1
      statement: Addition is constant time.
      priority: should
acceptance:
  scenarios:
    - id: AC-1
      covers:
        - FR-1
      given: Two integers
      when: They are added
      then: The sum is exact
      verifiedBy:
        - ${TARGET}
invariants:
  - id: INV-1
    statement: Addition never mutates its inputs.
    verifiedBy:
      - ${TARGET}
dependencies:
  - sdd/memory-bank/core/projectbrief.md
`);
  write(path.join(dir, "release-checklist.md"), "# Release Checklist\n\n- [x] Validation is green\n");
  if (!keep) fs.rmSync(starter, { recursive: true, force: true });
  ok(root, ["knowledge", "add", "--domain", "math", "--title", "Exact sums", "--statement", "Sums of integers are exact.", "--status", "active", "--verified", "--evidence", "owner confirmed", "--modules", "company-project"]);
  const rules = path.join(sdd(root), "memory-bank/business/math/rules.md");
  write(rules, read(rules).replace(/(Status: active\n(?:Affected Modules: .*\n)?(?:Evidence: .*\n)?)/, "$1Governs: ledger#FR-1, ledger#AC-1\n"));
  const index = path.join(sdd(root), "memory-bank/business/INDEX.md");
  write(index, read(index).replace(/\| math \| [^|]*\|/, "| math | sum,add,integer |"));
  write(path.join(sdd(root), "memory-bank/tech/modules.md"), `# Technical Module Index\n\n| Module | Responsibility | Paths | Business Domains |\n| --- | --- | --- | --- |\n| company-project | Library | . | math |\n`);
}

const gateStatus = (root, stage, extra = []) => {
  const r = spectra(root, ["verify", "--gate", stage, ...extra, "--json"]);
  return JSON.parse(r.stdout);
};
const explain = (root, id) => json(root, ["verify", "--explain", id, "--json"]);
const verifiedState = root => explain(root, "ledger#FR-1").verification;

// ---------------------------------------------------------------------------------------------------- C1
test("C1: adopt run again keeps reviewed project intelligence, does not resurrect a deleted starter, and refreshes discovery", () => {
  const root = appProject();
  installed(root, "local", true);
  completeProject(root);
  addGovernedFeature(root);
  write(path.join(root, ".spectra/docs/company-project/notes.md"), "my notes\n");
  ok(root, ["index"]);
  assert.equal(status(root, ["check"]), 0, "fixture must be valid before re-adopt");
  const preserved = [
    "memory-bank/business/INDEX.md", "memory-bank/business/math/rules.md", "memory-bank/tech/modules.md", "memory-bank/core/projectbrief.md",
    "features/ledger/feature.spec.yaml", "governance/approval-state.yaml"
  ];
  const before = Object.fromEntries(preserved.map(file => [file, sha(path.join(sdd(root), file))]));
  const notes = sha(path.join(root, ".spectra/docs/company-project/notes.md"));
  const ruleId = /RULE-[A-Z]+-\d+/.exec(read(path.join(sdd(root), "memory-bank/business/math/rules.md")))[0];

  for (const round of [2, 3]) {
    // new repository evidence between runs: discovery must follow it
    write(path.join(root, "package.json"), read(path.join(root, "package.json")).replace('"test:a"', `"test:round${round}": "node --test", "test:a"`));
    ok(root, ["adopt", ".", "--git-mode", "local"]);
    for (const file of preserved) assert.equal(sha(path.join(sdd(root), file)), before[file], `round ${round}: ${file} changed`);
    assert.equal(sha(path.join(root, ".spectra/docs/company-project/notes.md")), notes);
    assert.equal(fs.existsSync(path.join(sdd(root), "features", STARTER)), false, `round ${round}: deleted starter resurrected`);
    assert.match(read(path.join(root, ".spectra/cache/index/repo-index.json")), new RegExp(`test:round${round}`), "Repo Index refreshed");
    assert.equal(status(root, ["check"]), 0, `round ${round}: check`);
    assert.equal(status(root, ["inspect", ruleId]), 0, `round ${round}: inspect ${ruleId}`);
  }
});

// ---------------------------------------------------------------------------------------------------- C2 / C3
function sharedVerified() {
  const root = appProject();
  installed(root, "shared");
  completeProject(root);
  addGovernedFeature(root);
  ok(root, ["index"]);
  git(root, "add", "-A"); git(root, "commit", "-qm", "spectra state");
  ok(root, ["verify", "--test-target", TARGET]);
  assert.equal(verifiedState(root), "verified");
  return root;
}

test("C2: Spectra's own reads, caches, reports and bookkeeping never stale verified evidence (shared mode)", () => {
  const root = sharedVerified();
  // The legacy shape: a project that already committed Spectra's derived output must converge too.
  spawnSync("git", ["add", "-f", ".spectra/cache", ".spectra/sdd/features/ledger/evals/reports"], { cwd: root });
  const steps = [
    ["status"], ["context", "--role", "planner", "--goal", "decide"], ["inspect", "ledger#FR-1"], ["verify", "--gate", "review"],
    ["eval", "ledger", "--suite", "smoke"], ["index"], ["diff", "semantic"]
  ];
  for (const step of steps) { spectra(root, step); assert.equal(verifiedState(root), "verified", `after ${step.join(" ")}`); }
  fs.rmSync(path.join(root, ".spectra/cache/knowledge"), { recursive: true, force: true });
  ok(root, ["inspect", "ledger#FR-1"]);
  assert.equal(verifiedState(root), "verified", "after knowledge map rebuild");
  write(path.join(sdd(root), "memory-bank/core/progress.md"), read(path.join(sdd(root), "memory-bank/core/progress.md")) + "\nnote\n");
  assert.equal(verifiedState(root), "verified", "after a progress note");
  ok(root, ["approve", "--stage", "product-approved"]);
  assert.equal(verifiedState(root), "verified", "after approval bookkeeping");
});

test("C2: real application, test and canonical spec changes still stale evidence", () => {
  const cases = [
    ["application source", root => write(path.join(root, "src/a.js"), read(path.join(root, "src/a.js")) + "// changed\n")],
    ["test source", root => write(path.join(root, "test/a.test.js"), read(path.join(root, "test/a.test.js")) + "// changed\n")],
    ["manifest", root => write(path.join(root, "package.json"), read(path.join(root, "package.json")).replace("node --test test/a.test.js", "node --test  test/a.test.js"))],
    ["feature spec", root => { const f = path.join(sdd(root), "features/ledger/feature.spec.yaml"); write(f, read(f).replace("exact sum", "exact total")); }],
    ["business rule", root => { const f = path.join(sdd(root), "memory-bank/business/math/rules.md"); write(f, read(f).replace("Sums of integers are exact.", "Sums of integers are always exact.")); }]
  ];
  for (const [label, change] of cases) {
    const root = sharedVerified();
    change(root);
    assert.equal(verifiedState(root), "stale", `${label} must stale the evidence`);
  }
});

test("C3: shared mode keeps disposable caches and reports out of Git, and out of change impact", () => {
  const root = sharedVerified();
  for (const step of [["context", "--role", "planner", "--goal", "decide"], ["inspect", "ledger#FR-1"], ["eval", "ledger", "--suite", "smoke"], ["index"]]) spectra(root, step);
  const dirty = git(root, "status", "--porcelain").split("\n").filter(Boolean).filter(line => /\.spectra\/cache\/|\/evals\/reports\//.test(line));
  assert.deepEqual(dirty, [], "derived/observation state must not appear in git status");
  assert.equal(git(root, "ls-files", ".spectra/cache", ".spectra/sdd/features/ledger/evals/reports").trim(), "");
  // even when a project had committed them, impact must not report them as product change
  spawnSync("git", ["add", "-f", ".spectra/cache"], { cwd: root });
  spectra(root, ["context", "--role", "planner", "--goal", "discover"]);
  fs.appendFileSync(path.join(root, ".spectra/cache/context/project.summary.json"), " ");
  let files = json(root, ["inspect", "--changed", "--json"]).files.map(f => f.path);
  assert.deepEqual(files.filter(f => /^\.spectra\/cache\//.test(f)), [], "cache files are not product impact");
  // a canonical change is still reported
  const spec = path.join(sdd(root), "features/ledger/feature.spec.yaml");
  write(spec, read(spec).replace("exact sum", "exact total"));
  files = json(root, ["inspect", "--changed", "--json"]).files.map(f => f.path);
  assert.ok(files.includes("sdd/features/ledger/feature.spec.yaml"), "canonical spec change must appear");
});

test("C3: local mode still keeps Spectra state out of normal tracking", () => {
  const root = appProject();
  installed(root, "local");
  completeProject(root);
  spectra(root, ["context", "--role", "planner", "--goal", "decide"]);
  assert.equal(git(root, "status", "--porcelain").trim(), "");
  assert.match(read(path.join(root, ".git/info/exclude")), /\/\.spectra\//);
});

// ---------------------------------------------------------------------------------------------------- C4
test("C4: check warns about an unresolved Affected Modules entry and the gate blocks on the same module", () => {
  const root = appProject();
  installed(root, "local");
  completeProject(root);
  addGovernedFeature(root);
  const rules = path.join(sdd(root), "memory-bank/business/math/rules.md");
  write(rules, read(rules).replace(/Affected Modules: .*/, "Affected Modules: ghost-module"));
  ok(root, ["index"]);
  const check = spectra(root, ["check"]);
  assert.equal(check.status, 0, "structure stays valid");
  assert.match(check.stdout + check.stderr, /ghost-module/, "check names the unresolved module");
  assert.match(check.stdout + check.stderr, /gate/i, "check says gates may block");
  const gate = gateStatus(root, "review");
  assert.equal(gate.status, "blocked");
  assert.match(JSON.stringify(gate.blockers), /ghost-module/, "the gate blocks on the same module");
  // a resolving module raises no warning
  write(rules, read(rules).replace("ghost-module", "company-project"));
  const clean = spectra(root, ["check"]);
  assert.doesNotMatch(clean.stdout + clean.stderr, /ghost-module|Affected Modules/);
});

// ---------------------------------------------------------------------------------------------------- C5
test("C5: knowledge add says when a domain cannot be routed, and route finds the rule once keywords exist", () => {
  const root = appProject();
  installed(root, "local");
  completeProject(root);
  const add = ok(root, ["knowledge", "add", "--domain", "billing", "--title", "Refund window", "--statement", "Refunds are allowed within 14 days.", "--status", "active", "--verified", "--evidence", "policy"]);
  assert.match(add.stdout + add.stderr, /routing keywords/i);
  assert.match(add.stdout + add.stderr, /business\/INDEX\.md/);
  const task = "Change the refund policy";
  const before = json(root, ["route", "--task", task, "--format", "json"]);
  assert.deepEqual(before.domains, [], "undiscoverable before keywords");
  const index = path.join(sdd(root), "memory-bank/business/INDEX.md");
  write(index, read(index).replace(/\| billing \| [^|]*\|/, "| billing | refund,policy |"));
  const after = json(root, ["route", "--task", task, "--format", "json"]);
  assert.deepEqual(after.domains, ["billing"]);
  const again = ok(root, ["knowledge", "add", "--domain", "billing", "--title", "Credit note", "--statement", "Credit notes mirror the invoice.", "--status", "active", "--verified", "--evidence", "policy"]);
  assert.doesNotMatch(again.stdout + again.stderr, /routing keywords/i, "no nagging once metadata suffices");
});

// ---------------------------------------------------------------------------------------------------- C6
function interactive(root, answers) {
  const driver = path.join(os.tmpdir(), `spectra-pty-${process.pid}.py`);
  fs.writeFileSync(driver, `import os, pty, select, sys, time
answers = sys.argv[1].split("|"); cmd = sys.argv[2:]
pid, fd = pty.fork()
if pid == 0: os.execvp(cmd[0], cmd)
out = b""; i = 0; last = time.time()
while True:
    r, _, _ = select.select([fd], [], [], 0.5)
    if r:
        try: d = os.read(fd, 4096)
        except OSError: break
        if not d: break
        out += d; last = time.time()
    elif time.time() - last > 0.4 and i < len(answers): os.write(fd, (answers[i] + "\\n").encode()); i += 1; last = time.time()
    elif time.time() - last > 8: break
sys.stdout.write(out.decode(errors="replace"))
`);
  const cli = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "bin", "spectra.js");
  return spawnSync("python3", [driver, answers.join("|"), process.execPath, cli, "onboard", "--force"], { cwd: root, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(path.dirname(cli), "..", "assets") } });
}

test("C6: onboard names exactly what check will still reject", { skip: spawnSync("python3", ["--version"]).status !== 0 }, () => {
  const root = appProject();
  installed(root, "local");
  const run = interactive(root, ["Company Project", "Add numbers", "Library", "Engineers"]);
  assert.match(run.stdout, /Wrote/);
  const check = spectra(root, ["check"]);
  assert.notEqual(check.status, 0, "fixture: check is red after onboarding");
  const rejected = [...(check.stdout + check.stderr).matchAll(/^- (\S+): /gm)].map(m => m[1]).sort();
  assert.ok(rejected.length > 0);
  for (const file of rejected) assert.ok(run.stdout.includes(file), `onboard must mention ${file}`);
  assert.match(run.stdout, /spectra check/);
  assert.doesNotMatch(run.stdout, /ready/i);
});

test("C6: onboard stays quiet about readiness when check is already green", { skip: spawnSync("python3", ["--version"]).status !== 0 }, () => {
  const root = appProject();
  installed(root, "local");
  completeProject(root);
  const run = interactive(root, ["Company Project", "Add numbers", "Library", "Engineers"]);
  assert.match(run.stdout, /Wrote/);
  assert.equal(status(root, ["check"]), 0);
  assert.doesNotMatch(run.stdout, /still fail|not ready|incomplete/i);
});

// ---------------------------------------------------------------------------------------------------- C7
function require_yaml(text) { return spawnSync(process.execPath, ["-e", "const y=require('yaml');process.stdout.write(JSON.stringify(y.parse(require('fs').readFileSync(0,'utf8'))))"], { input: text, encoding: "utf8", cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), "..") }).stdout; }

test("C7: an unmodified starter feature is not a consumer product feature, a real or edited one is", () => {
  const root = appProject();
  installed(root, "local", true);
  const specs = () => JSON.parse(require_yaml(read(path.join(sdd(root), "adoption/gap-analysis.yaml")))).items.find(item => item.requirement_id === "ADOPT-SPECS");
  assert.equal(specs().category, "missing", "starter alone is not an executable feature");
  assert.deepEqual(specs().evidence, []);
  completeProject(root);
  const verify = spectra(root, ["verify"]);
  assert.doesNotMatch(verify.stdout + verify.stderr, new RegExp(`${STARTER}[^\\n]*release-checklist`), "starter checklist must not block release readiness");
  // editing the starter makes it the user's
  const spec = path.join(sdd(root), "features", STARTER, "feature.spec.yaml");
  write(spec, read(spec).replace("Users need a controlled way", "Operators need a controlled way"));
  ok(root, ["adopt", ".", "--git-mode", "local"]);
  assert.equal(specs().category, "matches", "an edited starter is a real feature");
  const edited = spectra(root, ["verify"]);
  assert.match(edited.stdout + edited.stderr, /release-checklist\.md/, "an edited feature's checklist counts");
});

test("C7: a feature added by the user always counts", () => {
  const root = appProject();
  installed(root, "local", true);
  completeProject(root);
  addGovernedFeature(root, { keep: true });
  ok(root, ["adopt", ".", "--git-mode", "local"]);
  const item = JSON.parse(require_yaml(read(path.join(sdd(root), "adoption/gap-analysis.yaml")))).items.find(entry => entry.requirement_id === "ADOPT-SPECS");
  assert.equal(item.category, "matches");
  assert.deepEqual(item.evidence, ["sdd/features/ledger"]);
});
