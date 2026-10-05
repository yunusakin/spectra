// Verification model hardening. Failure modes this file exists to catch (written before the code):
//  - one unrelated failing test domain failing every subject that shares a package's aggregate target
//  - a named package sub-target (`scripts.test:<name>`) not becoming a stable Repo Index test target,
//    or running more than its own command, or changing identity when its command changes
//  - a deleted/renamed sub-target leaving a scope that still looks verified (old evidence must not count)
//  - a narrowed review gate passing because scope resolution silently returned nothing (bad --base ref,
//    not a git repository)
//  - handwritten AGENTS.md / CLAUDE.md rejected as "generated adapter output" while real generated
//    adapters must still be rejected in a canonical repository
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { buildTraceability } from "../src/lib/traceability/trace.js";
import { concludeVerification, readVerificationEvidence } from "../src/lib/traceability/evidence.js";
import { evaluateGate } from "../src/lib/traceability/gates.js";
import { runTestTarget } from "../src/lib/traceability/run.js";
import { validateBusinessContext } from "../src/lib/business/validator.js";
import { readIndex } from "../src/lib/index/cache.js";
import { recordVerificationEvidence } from "../src/lib/traceability/evidence.js";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(cliRoot, "bin", "spectra.js");
const run = (cwd, args) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const sdd = (root) => path.join(root, ".spectra", "sdd");
const specFile = (root) => path.join(sdd(root), "features", "alpha", "feature.spec.yaml");
const AGG = "node:test-target:packages/app";
const ALPHA = "node:test-target:packages/app:test:alpha";
const BETA = "node:test-target:packages/app:test:beta";

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

const scripts = (extra = {}) => ({ test: "node --test", "test:alpha": "node --test alpha.test.js", "test:beta": "node --test beta.test.js", ...extra });

// One module with an aggregate target and two independent named sub-targets (alpha passes, beta fails).
function project({ fra = [ALPHA], frb = [BETA], pkgScripts = scripts() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-hardening-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "packages", "app", "package.json"), JSON.stringify({ name: "app", scripts: pkgScripts }));
  write(path.join(root, "packages", "app", "alpha.test.js"), "const test = require('node:test');\nrequire('fs').writeFileSync(__dirname + '/ran-alpha.txt', 'x');\ntest('alpha', () => {});\n");
  write(path.join(root, "packages", "app", "beta.test.js"), "const test = require('node:test');\nrequire('fs').writeFileSync(__dirname + '/ran-beta.txt', 'x');\ntest('beta', () => { throw new Error('beta broke'); });\n");
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), ["# Technical Module Index", "", "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |", "| app | App | packages/app/ | shop |", ""].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "INDEX.md"), ["# Business Domain Index", "", "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |", "| shop | orders | business/shop/rules.md | business/shop/unresolved.md | app |", ""].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "shop", "rules.md"), [
    "# Rules", "",
    "## RULE-SHP-001 — Alpha", "", "Alpha behaviour holds.", "", "Status: active", "Affected Modules: app", "Governs: alpha#FR-A", "",
    "## RULE-SHP-002 — Beta", "", "Beta behaviour holds.", "", "Status: active", "Affected Modules: app", "Governs: alpha#FR-B", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "shop", "unresolved.md"), "# U\n");
  const scoped = (ids) => (ids.length > 0 ? { verifiedBy: ids } : {});
  write(specFile(root), YAML.stringify({
    apiVersion: "spectra/v2", kind: "FeatureSpec", metadata: { id: "alpha", name: "Alpha", version: "0.1.0", owner: "product", status: "draft" },
    summary: { problem: "p", outcome: "o" }, scope: { in: ["a"], out: ["b"] },
    requirements: { functional: [
      { id: "FR-A", statement: "Alpha holds.", priority: "must", ...scoped(fra) },
      { id: "FR-B", statement: "Beta holds.", priority: "must", ...scoped(frb) }
    ], nonFunctional: [] },
    acceptance: { scenarios: [] }, dependencies: []
  }));
  assert.equal(run(root, ["index"]).status, 0);
  const git = (...args) => assert.equal(spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root }).status, 0);
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");
  return root;
}

const conclude = (root, id) => concludeVerification(buildTraceability(root), readVerificationEvidence(root), id);
const gate = (root, stage, rules = null) => evaluateGate(buildTraceability(root), readVerificationEvidence(root), stage, { rules });
const records = (root) => readIndex(root).records.filter((record) => record.kind === "test-target");

test("named package scripts `test:<name>` become stable Repo Index test targets next to the aggregate one", () => {
  const root = project({ pkgScripts: scripts({ "test:bad name": "x", "testing": "y", "lint": "z" }) });
  const targets = Object.fromEntries(records(root).map((record) => [record.id, record]));
  assert.deepEqual(Object.keys(targets).filter((id) => id.includes("packages/app")).sort(), [AGG, ALPHA, BETA].sort());
  assert.equal(targets[ALPHA].attributes.command, "node --test alpha.test.js");
  assert.equal(targets[ALPHA].path, "packages/app", "path stays the directory the command runs from");
  assert.equal(targets[AGG].attributes.command, "node --test");
  const before = JSON.stringify(records(root).map((record) => record.id));
  assert.equal(run(root, ["index"]).status, 0);
  assert.equal(JSON.stringify(records(root).map((record) => record.id)), before, "ids are stable across rebuilds");
});

test("an unrelated failing target no longer fails an independent subject, and a target runs only its own command", async () => {
  const root = project();
  const alpha = await runTestTarget(root, ALPHA);
  assert.equal(alpha.result, "passed");
  assert.equal(fs.existsSync(path.join(root, "packages", "app", "ran-beta.txt")), false, "running alpha must not execute beta's file");
  const beta = await runTestTarget(root, BETA);
  assert.equal(beta.result, "failed");
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified");
  assert.equal(conclude(root, "alpha#FR-B").verification, "failed");
  assert.equal(conclude(root, "RULE-SHP-001").verification, "verified", "RULE-SHP-001's only scope is alpha");
  assert.equal(conclude(root, "RULE-SHP-002").verification, "failed");
  const review = gate(root, "review");
  assert.deepEqual([...new Set(review.blockers.map((entry) => entry.rule))], ["RULE-SHP-002"], "only the beta rule is blocked");
});

test("a sub-target's identity does not depend on its command, and a changed command makes its evidence stale", async () => {
  const root = project();
  await runTestTarget(root, ALPHA);
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified");
  write(path.join(root, "packages", "app", "package.json"), JSON.stringify({ name: "app", scripts: scripts({ "test:alpha": "node --test alpha.test.js --test-reporter=tap" }) }));
  assert.equal(run(root, ["index"]).status, 0);
  assert.ok(records(root).some((record) => record.id === ALPHA), "same id after the command changed");
  assert.equal(conclude(root, "alpha#FR-A").verification, "stale");
});

test("a removed sub-target breaks its scope instead of leaving old evidence looking verified", async () => {
  const root = project();
  await runTestTarget(root, ALPHA);
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified");
  write(path.join(root, "packages", "app", "package.json"), JSON.stringify({ name: "app", scripts: { test: "node --test", "test:beta": "node --test beta.test.js" } }));
  assert.equal(run(root, ["index"]).status, 0);
  assert.ok(readVerificationEvidence(root).records.some((record) => record.testTarget === ALPHA), "the old record is still in the local cache");
  assert.notEqual(conclude(root, "alpha#FR-A").verification, "verified");
  assert.ok(validateBusinessContext(root).some((error) => /alpha#FR-A.*does not exist/.test(error)));
  for (const stage of ["review", "release"]) assert.ok(gate(root, stage).blockers.some((entry) => entry.code === "broken-canonical-structure" && entry.subject === "alpha#FR-A"), stage);
});

test("a narrowed review gate never passes because scope resolution returned nothing", () => {
  const root = project();
  const bad = run(root, ["verify", "--gate", "review", "--base", "no-such-ref"]);
  assert.equal(bad.status, 1, bad.stdout);
  assert.match(`${bad.stdout}${bad.stderr}`, /no-such-ref/);
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  const result = JSON.parse(run(root, ["verify", "--gate", "review", "--changed", "--json"]).stdout);
  assert.equal(result.scope.kind, "project", "without git the changed files cannot be determined: the gate falls back to the whole project");
  assert.ok(result.warnings.some((entry) => entry.code === "scope-undeterminable"), JSON.stringify(result.warnings));
  assert.equal(result.status, "blocked", "required scopes without evidence still block");
});

function canonicalRepo({ adapters = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-canonical-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  if (adapters) {
    // Generate with the runtime generator itself (the `adapters` command also requires the agent CLIs on PATH),
    // before the repository turns canonical, exactly as the validator's own smoke generation does.
    const script = path.join(cliRoot, "..", "core", "assets", "runtime", "scripts", "generate-adapters.sh");
    const generated = spawnSync("bash", [script, "--agents", "claude,codex,copilot,cursor", "--target", root], { cwd: root, encoding: "utf8", env: { ...process.env, SPECTRA_PROJECT_DOCS_NAME: "fixture" } });
    assert.equal(generated.status, 0, generated.stdout + generated.stderr);
  }
  fs.renameSync(path.join(root, ".spectra", "sdd"), path.join(root, "sdd"));
  const manifest = path.join(root, "sdd", "system", "manifest.env");
  fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(/^repo_mode=.*$/m, "repo_mode=canonical"));
  return root;
}
const adapterErrors = (root) => `${run(root, ["validate"]).stdout}`.split("\n").filter((line) => /generated adapter output|Adapter output/.test(line));

test("a canonical repository may commit handwritten AGENTS.md and CLAUDE.md", () => {
  const root = canonicalRepo();
  write(path.join(root, "AGENTS.md"), "# Agent Instructions\n\nHandwritten guidance.\n");
  write(path.join(root, "CLAUDE.md"), "@AGENTS.md\n");
  assert.deepEqual(adapterErrors(root), []);
});

test("a canonical repository still rejects committed Spectra-generated adapters", () => {
  const root = canonicalRepo({ adapters: true });
  const errors = adapterErrors(root).join("\n");
  for (const file of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]) assert.match(errors, new RegExp(file.replace(/[.]/g, "\\.")), file);
});

test("the producer does not leak an outer node test runner context into the command it runs", async () => {
  const root = project();
  const outer = process.env.NODE_TEST_CONTEXT;
  process.env.NODE_TEST_CONTEXT = "child-v8";
  try {
    assert.equal((await runTestTarget(root, BETA)).result, "failed", "a failing `node --test` file must read as failed even when spectra itself runs under node --test");
  } finally {
    if (outer === undefined) delete process.env.NODE_TEST_CONTEXT;
    else process.env.NODE_TEST_CONTEXT = outer;
  }
});

// ---- Review findings ---------------------------------------------------------------------------------------

test("editing a file in the target's directory makes its evidence stale; an unrelated directory does not", async () => {
  const root = project();
  await runTestTarget(root, ALPHA);
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified");
  write(path.join(root, "unrelated", "notes.txt"), "outside the package\n");
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified", "a file outside the target's directory is not its source");
  write(path.join(root, "packages", "app", "alpha.test.js"), "const test = require('node:test');\ntest('alpha', () => {});\n// edited\n");
  const stale = conclude(root, "alpha#FR-A");
  assert.equal(stale.verification, "stale");
  assert.ok(stale.scopes.some((scope) => scope.staleBecause.some((entry) => /source/.test(entry))), JSON.stringify(stale.scopes));
  assert.equal(gate(root, "implementation").status, "allowed");
  assert.equal(gate(root, "review", ["RULE-SHP-001"]).status, "blocked");
  await runTestTarget(root, ALPHA);
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified");
  assert.equal(gate(root, "review", ["RULE-SHP-001"]).status, "allowed");
});

test("the run's own output files do not stale its result, and a record without a source fingerprint is stale", async () => {
  const root = project();
  await runTestTarget(root, ALPHA);
  assert.equal(fs.existsSync(path.join(root, "packages", "app", "ran-alpha.txt")), true, "the fixture's test writes an output file into its own directory");
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified");
  fs.rmSync(path.join(root, "packages", "app", "ran-alpha.txt"));
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified", "cleaning the output back to the pre-run tree is fresh too");
  await runTestTarget(root, BETA);
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified", "a sibling target writing its output next to the same sources does not stale this one");
  const old = project();
  recordVerificationEvidence(old, { testTarget: ALPHA, result: "passed", command: "x", sourceFingerprint: null, sourceFingerprintBefore: null });
  assert.equal(conclude(old, "alpha#FR-A").verification, "stale", "an old record cannot be shown to match the current sources");
});

test("without git the source fingerprint is absent on both sides and evidence stays usable", async () => {
  const root = project();
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  await runTestTarget(root, ALPHA);
  assert.equal(conclude(root, "alpha#FR-A").verification, "verified");
});

test("scripts that cannot be verified as one-shot test runs (watch mode) are not recorded as test targets", () => {
  const root = project({ pkgScripts: scripts({ "test:watch": "node --test --watch", "test:jest-watch": "jest --watchAll", "test:unit": "node --test alpha.test.js" }) });
  const ids = records(root).map((record) => record.id);
  assert.equal(ids.some((id) => /test:watch|test:jest-watch/.test(id)), false, JSON.stringify(ids));
  assert.ok(ids.includes("node:test-target:packages/app:test:unit"));
});

test("a handwritten adapter that only shares the generated heading is accepted in a canonical repository", () => {
  const root = canonicalRepo();
  write(path.join(root, "AGENTS.md"), "# Spectra Adapter (Codex)\n\nOur own notes for this repository, not generated.\n");
  assert.deepEqual(adapterErrors(root), []);
});
