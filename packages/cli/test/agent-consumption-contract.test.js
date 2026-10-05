// Agent consumption contract (CLI + deterministic JSON + generated adapters). Failure modes this file exists
// to catch (written before the code):
//  F1/F2  generated adapter does not teach `inspect`, or does not say when to use it instead of `context`
//  F3     adapter encourages broad exploration instead of asking Spectra first
//  F4     adapter teaches mutating or execution-heavy commands as ordinary intelligence queries
//  F5     agent-facing JSON carries machine-specific absolute paths
//  F6     agent-facing JSON has no contract version
//  F7     `--json` / `--format json` query failure answered with human-only `FAIL ...` text
//  F8     `status` not consumable as structured data, or its JSON disagreeing with the human view
//  F9     human output changed by the JSON work
//  F11    shared guidance drifting between generated targets, or naming one model vendor
//  F12    consumption changes altering verification conclusions, gate status or exit semantics
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const sdd = (root) => path.join(root, ".spectra", "sdd");
const LOY = "node:test-target:packages/loyalty";
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, "utf8"); };
const git = (root, ...args) => assert.equal(spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root }).status, 0, args.join(" "));

// One loyalty module, one rule governing FR-1, an invariant, an acceptance scenario. Same content at every location.
function project(label = "a", agents = null) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `spectra-consume-${label}-`)));
  git(root, "init", "-q");
  const init = run(root, ["init", "."]);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  if (agents) {
    // The runtime generator itself, like `spectra adapters` minus its check that each agent CLI is on PATH
    // (CI machines have none of them).
    const script = path.join(cliRoot, "..", "core", "assets", "runtime", "scripts", "generate-adapters.sh");
    const generated = spawnSync("bash", [script, "--agents", agents, "--target", root], { cwd: path.join(root, ".spectra"), encoding: "utf8", env: { ...process.env, SPECTRA_REPO_ROOT: path.join(root, ".spectra"), SPECTRA_PROJECT_DOCS_NAME: "fixture" } });
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  }
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty", scripts: { test: "node check.js" } }));
  write(path.join(root, "packages", "loyalty", "check.js"), "process.exit(0);\n");
  write(path.join(root, "packages", "loyalty", "src", "index.js"), "module.exports = 1;\n");
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "", "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| loyalty-api | Loyalty | packages/loyalty/ | loyalty |", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "INDEX.md"), [
    "# Business Domain Index", "", "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| loyalty | points | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "rules.md"), [
    "# Rules", "", "## RULE-LOY-001 — Expiration", "", "Expired points cannot pay for orders.", "", "Status: active", "Affected Modules: loyalty-api", "Governs: alpha#FR-1", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "unresolved.md"), "# U\n");
  write(path.join(sdd(root), "features", "alpha", "feature.spec.yaml"), YAML.stringify({
    apiVersion: "spectra/v2", kind: "FeatureSpec", metadata: { id: "alpha", name: "Alpha", version: "0.1.0", owner: "product", status: "draft" },
    summary: { problem: "p", outcome: "o" }, scope: { in: ["a"], out: ["b"] },
    requirements: { functional: [{ id: "FR-1", statement: "Expired points cannot pay.", priority: "must", verifiedBy: [LOY] }], nonFunctional: [] },
    invariants: [{ id: "INV-1", statement: "Caches are derived.", verifiedBy: [LOY] }],
    acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "g", when: "w", then: "t", verifiedBy: [LOY] }] },
    dependencies: []
  }));
  assert.equal(run(root, ["index"]).status, 0);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "fixture");
  return root;
}

const json = (result) => JSON.parse(result.stdout);
// `context --route-task` rebuilds the derived Knowledge Map on its first call ("rebuilt-missing", later "fresh"):
// existing cache behaviour, so a comparison between calls starts from a warm project.
const warm = (root) => { for (const [, call] of SURFACES) call(root); return root; };
const SURFACES = [
  ["context --format json", (root) => run(root, ["context", "--role", "planner", "--goal", "discover", "--format", "json"])],
  ["context --route-task --format json", (root) => run(root, ["context", "--route-task", "loyalty points", "--format", "json"])],
  ["route --format json", (root) => run(root, ["route", "--task", "loyalty points", "--format", "json"])],
  ["inspect <id> --json", (root) => run(root, ["inspect", "RULE-LOY-001", "--json"])],
  ["inspect --file --json", (root) => run(root, ["inspect", "--file", "packages/loyalty/src/index.js", "--json"])],
  ["verify --explain --json", (root) => run(root, ["verify", "--explain", "RULE-LOY-001", "--json"])],
  ["verify --gate review --json", (root) => run(root, ["verify", "--gate", "review", "--changed", "--json"])],
  ["status --json", (root) => run(root, ["status", "--json"])]
];

// ---- adapters ---------------------------------------------------------------------------------------

const AGENT_FILES = {
  claude: ["CLAUDE.md"], codex: ["AGENTS.md"], copilot: [".github/copilot-instructions.md"],
  cursor: [".cursor/rules/spectra-core.mdc"], windsurf: [".windsurf/rules/spectra-core.md"], antigravity: [".agent/rules/spectra-core.md"]
};

// The shared guidance is one section of the shared adapter body; every target must carry it verbatim.
function guidance(text) {
  const match = text.match(/^## Project Intelligence\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  return match ? match[1].trim() : null;
}

test("every generated adapter teaches the same read-only Project Intelligence decision model", () => {
  const root = project("adapters", Object.keys(AGENT_FILES).join(","));
  const sections = Object.entries(AGENT_FILES).map(([agent, files]) => {
    const text = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    const section = guidance(text);
    assert.ok(section, `${agent}: no Project Intelligence section`);
    return [agent, section];
  });
  const [, reference] = sections[0];
  for (const [agent, section] of sections) assert.equal(section, reference, `${agent} guidance drifted from the shared block`);

  const L = "./.spectra/bin/spectra";
  for (const command of [
    `${L} context`, `${L} inspect <id> --json`, `${L} inspect --changed --json`,
    `${L} verify --explain <id> --json`, `${L} verify --gate review --changed --json`, `${L} verify --gate release --json`
  ]) assert.ok(reference.includes(command), `guidance does not teach \`${command}\``);
  assert.match(reference, /instead of (broad|manual)[^.]*explor/i, "guidance does not prefer Spectra over broad manual exploration");
  assert.match(reference, /does not replace (reading|inspecting)[^.]*code/i, "guidance must not claim to replace normal code inspection");
  assert.match(reference, /context[^.]*smallest|smallest[^.]*context/i, "guidance does not say what context is for");
  assert.match(reference, /known[^.]*(ID|subject)/i, "guidance does not say inspect is for a known subject");
});

test("shared guidance stays read-only and vendor-neutral", () => {
  const root = project("neutral", "claude");
  const section = guidance(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"));
  assert.ok(section);
  assert.doesNotMatch(section, /spectra (approve|migrate|update|uninstall|eval|adapters|knowledge|onboard|init|adopt)\b|doctor --fix|--test-target|checkpoint/i);
  assert.doesNotMatch(section, /\b(Claude|Codex|Cursor|Copilot|Windsurf|Antigravity|GPT|Gemini)\b/);
  assert.match(section, /do not mutate canonical project knowledge, governance, approvals, or verification evidence/i);
  assert.match(section, /`context` and `route` may refresh disposable derived caches/);
  assert.doesNotMatch(section, /Everything in this section is read-only/);
  assert.doesNotMatch(section, /inspectSubject|analyzeImpact|concludeVerification|evaluateGate/);
});

// ---- contract version, path policy, determinism ---------------------------------------------------

test("every agent-facing JSON surface is versioned, first-field, and free of absolute paths", () => {
  const root = project("surfaces");
  for (const [name, call] of SURFACES) {
    const result = call(root);
    assert.ok(result.stdout.trim().startsWith("{"), `${name}: stdout is not JSON: ${result.stderr}`);
    const parsed = json(result);
    assert.equal(parsed.contractVersion, 1, `${name}: contractVersion`);
    assert.equal(Object.keys(parsed)[0], "contractVersion", `${name}: contractVersion is not the first field`);
    assert.equal(result.stdout.includes(root), false, `${name} leaks the project path`);
    assert.equal(result.stdout.includes(os.tmpdir()), false, `${name} leaks a temp path`);
    assert.equal(result.stdout.includes(os.homedir()), false, `${name} leaks the home directory`);
  }
});

test("equivalent projects at different absolute locations yield equivalent context and route JSON", () => {
  const first = warm(project("loc-one"));
  const second = warm(project("loc-two-with-a-longer-name"));
  assert.notEqual(first, second);
  // The Repo Index records when it was built (derived state, written by `spectra index`); the two projects were
  // indexed at different moments, so that one field is the only legitimate difference.
  const withoutBuildTime = (document) => { if (document.repoIndex) delete document.repoIndex.generatedAt; return document; };
  for (const [name, call] of SURFACES.filter(([label]) => /^(context|route)/.test(label))) {
    assert.deepEqual(withoutBuildTime(json(call(first))), withoutBuildTime(json(call(second))), `${name} differs by location`);
  }
});

test("agent-facing JSON is byte-identical across repeated runs on unchanged state", () => {
  const root = warm(project("determinism"));
  for (const [name, call] of SURFACES) assert.equal(call(root).stdout, call(root).stdout, name);
});

// ---- structured query errors -----------------------------------------------------------------------

test("an expected query failure under --json is structured, non-zero, and path-free", () => {
  const root = project("errors");
  const cases = [
    ["inspect unknown", ["inspect", "RULE-NOPE-999", "--json"], "subject-not-found"],
    ["inspect repo-index record", ["inspect", "node:project:.", "--json"], "subject-not-inspectable"],
    ["verify --explain unknown", ["verify", "--explain", "RULE-NOPE-999", "--json"], "subject-not-found"],
    ["inspect bad arguments", ["inspect", "--json"], "invalid-arguments"],
    ["inspect file outside project", ["inspect", "--file", "../outside.js", "--json"], "file-outside-project"],
    ["inspect bad ref", ["inspect", "--base", "no-such-ref", "--json"], "invalid-ref"],
    ["route missing task", ["route", "--format", "json"], "invalid-arguments"]
  ];
  for (const [label, args, code] of cases) {
    const result = run(root, args);
    assert.equal(result.status, 1, label);
    const parsed = json(result);
    assert.equal(parsed.contractVersion, 1, label);
    assert.equal(parsed.ok, false, label);
    assert.equal(parsed.error.code, code, label);
    assert.equal(typeof parsed.error.message, "string", label);
    assert.equal(result.stdout.includes(root), false, `${label} leaks the project path`);
    assert.doesNotMatch(result.stdout + result.stderr, /\n\s+at \S+/, `${label} prints a stack trace`);
  }
});

test("a --json query outside any Spectra project fails structured, without naming the directory", () => {
  const empty = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-consume-none-")));
  for (const args of [["inspect", "RULE-LOY-001", "--json"], ["verify", "--explain", "X", "--json"], ["verify", "--gate", "review", "--json"], ["status", "--json"]]) {
    const result = run(empty, args);
    assert.equal(result.status, 1, args.join(" "));
    const parsed = json(result);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, "project-not-found");
    assert.equal(result.stdout.includes(empty), false);
  }
});

test("without --json the same failures keep the human FAIL text on stderr and an empty stdout", () => {
  const root = project("human-errors");
  for (const args of [["inspect", "RULE-NOPE-999"], ["verify", "--explain", "RULE-NOPE-999"]]) {
    const result = run(root, args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^FAIL Unknown subject: RULE-NOPE-999/);
    assert.equal(result.stdout, "");
  }
});

// ---- semantics unchanged ------------------------------------------------------------------------------

test("verification conclusions, gate status and exit semantics are unchanged by the contract", () => {
  const root = project("semantics");
  let explain = json(run(root, ["verify", "--explain", "RULE-LOY-001", "--json"]));
  assert.equal(explain.verification, "unverified");
  const blocked = run(root, ["verify", "--gate", "release", "--json"]);
  assert.equal(blocked.status, 1);
  assert.equal(json(blocked).status, "blocked");
  assert.ok(json(blocked).blockers.length > 0);

  assert.equal(run(root, ["verify", "--test-target", LOY]).status, 0);
  explain = json(run(root, ["verify", "--explain", "RULE-LOY-001", "--json"]));
  assert.equal(explain.verification, "verified");
  const subject = json(run(root, ["inspect", "RULE-LOY-001", "--json"]));
  assert.equal(subject.verification.state, "verified");
  const allowed = run(root, ["verify", "--gate", "release", "--json"]);
  assert.equal(allowed.status, 0);
  assert.equal(json(allowed).status, "allowed");
});

// ---- status --json ---------------------------------------------------------------------------------------

test("status --json is the same state as the human status, and does not change the human view", () => {
  const root = project("status");
  write(path.join(root, "notes.md"), "wip\n");
  const human = run(root, ["status"]);
  assert.equal(human.status, 0);
  const status = json(run(root, ["status", "--json"]));
  assert.equal(status.contractVersion, 1);
  assert.equal(`Approval State: ${status.approval.currentState}`, human.stdout.match(/^Approval State: .*$/m)[0]);
  assert.equal(`Highest Valid: ${status.approval.highestValid}`, human.stdout.match(/^Highest Valid: .*$/m)[0]);
  const bullets = [...human.stdout.matchAll(/^- (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(status.recentUpdates, bullets.filter((bullet) => !/^No recent project changes/.test(bullet)));
  assert.ok(status.recentUpdates.includes("notes.md"));
  assert.match(human.stdout, /^Next recommended action:\n {2}spectra check$/m);
  assert.equal(status.nextAction, "spectra check");
  assert.ok(Array.isArray(status.approval.invalidations));
  assert.equal(run(root, ["status", "--json", "--bogus"]).status, 1);
});
