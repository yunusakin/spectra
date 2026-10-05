// Project Intelligence query & change impact (`spectra inspect`). Failure modes this file exists to catch
// (written before the code):
//  - unknown ID answered with an empty/fuzzy result or exit 0; duplicate semantic identity silently picking one
//  - a second verification conclusion path (inspect disagreeing with `verify --explain`)
//  - impact disagreeing with the review gate about which rules a set of changed files concerns
//  - impact inferred lexically, or an unrelated module's change reaching unrelated rules
//  - root-module file dropped or attributed to every module; file outside any known module silently ignored
//  - empty diff indistinguishable from "nothing to report"; invalid git ref returning empty impact;
//    outside git, --changed/--base silently empty
//  - canonical file changes (feature spec, rule file) not reaching their subjects/rules
//  - subject with no verification scope shown as verified; failed/stale evidence not explained
//  - several rules governing one module not all reported
//  - broken canonical edge (deleted verifiedBy target) hidden; stale/missing Repo Index unreported
//  - a read-only query that writes canonical data, evidence or approvals; nondeterministic JSON
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
const specFile = (root) => path.join(sdd(root), "features", "alpha", "feature.spec.yaml");
const rulesFile = (root) => path.join(sdd(root), "memory-bank", "business", "loyalty", "rules.md");
const LOY = "node:test-target:packages/loyalty";
const BIL = "node:test-target:packages/billing";
const MOD_LOY = "node:module:packages/loyalty";
const MOD_BIL = "node:module:packages/billing";

const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, "utf8"); };
const git = (root, ...args) => assert.equal(spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root }).status, 0, args.join(" "));
const commitAll = (root) => { git(root, "add", "-A"); git(root, "commit", "-q", "-m", "fixture"); };

function spec({ fr1 = [LOY], fr2 = [], ac1 = [BIL] } = {}) {
  const scoped = (ids) => (ids.length > 0 ? { verifiedBy: ids } : {});
  return {
    apiVersion: "spectra/v2", kind: "FeatureSpec", metadata: { id: "alpha", name: "Alpha", version: "0.1.0", owner: "product", status: "draft" },
    summary: { problem: "p", outcome: "o" }, scope: { in: ["a"], out: ["b"] },
    requirements: { functional: [
      { id: "FR-1", statement: "Expired points cannot pay.", priority: "must", ...scoped(fr1) },
      { id: "FR-2", statement: "Totals round half up.", priority: "must", ...scoped(fr2) }
    ], nonFunctional: [] },
    invariants: [{ id: "INV-1", statement: "Caches are derived.", verifiedBy: [LOY] }],
    acceptance: { scenarios: [{ id: "AC-1", covers: ["FR-1"], given: "g", when: "w", then: "t", ...scoped(ac1) }] },
    dependencies: []
  };
}

// loyalty (RULE-LOY-001 FR-1, RULE-LOY-003 INV-1) and billing (RULE-LOY-002 FR-2); `governsBoth` makes
// RULE-LOY-001 affect billing too (two rules on one module).
function project({ governsBoth = false, fixtureSpec = {}, withoutGit = false } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-intel-")));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  assert.equal(run(root, ["init", "."]).status, 0);
  write(path.join(root, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "README.md"), "# shop\n");
  for (const pkg of ["loyalty", "billing"]) {
    write(path.join(root, "packages", pkg, "package.json"), JSON.stringify({ name: pkg, scripts: { test: "node check.js" } }));
    write(path.join(root, "packages", pkg, "check.js"), "process.exit(Number(require('fs').readFileSync(__dirname + '/exit.txt', 'utf8')));\n");
    write(path.join(root, "packages", pkg, "exit.txt"), "0");
    write(path.join(root, "packages", pkg, "src", "index.js"), "module.exports = 1;\n");
  }
  write(path.join(sdd(root), "memory-bank", "tech", "modules.md"), [
    "# Technical Module Index", "", "| Module | Responsibility | Paths | Business Domains |", "| --- | --- | --- | --- |",
    "| loyalty-api | Loyalty | packages/loyalty/ | loyalty |", "| billing | Billing | packages/billing/ | loyalty |", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "INDEX.md"), [
    "# Business Domain Index", "", "| Domain | Keywords | Rules | Unresolved | Related Modules |", "| --- | --- | --- | --- | --- |",
    "| loyalty | points | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |", ""
  ].join("\n"));
  write(rulesFile(root), [
    "# Rules", "",
    "## RULE-LOY-001 — Expiration", "", "Expired points cannot pay for orders.", "", "Status: active", `Affected Modules: ${governsBoth ? "loyalty-api, billing" : "loyalty-api"}`, "Governs: alpha#FR-1", "",
    "## RULE-LOY-002 — Rounding", "", "Totals round half up.", "", "Status: active", "Affected Modules: billing", "Governs: alpha#FR-2", "",
    "## RULE-LOY-003 — Derived caches", "", "Caches never hold the only copy.", "", "Status: active", "Affected Modules: loyalty-api", "Governs: alpha#INV-1", ""
  ].join("\n"));
  write(path.join(sdd(root), "memory-bank", "business", "loyalty", "unresolved.md"), "# U\n");
  write(specFile(root), YAML.stringify(spec(fixtureSpec)));
  assert.equal(run(root, ["index"]).status, 0);
  commitAll(root);
  if (withoutGit) fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  return root;
}

const inspect = (root, ...args) => { const r = run(root, ["inspect", ...args, "--json"]); return { ...r, json: r.stdout.trim().startsWith("{") ? JSON.parse(r.stdout) : null }; };
const ids = (items) => items.map((item) => item.id);
const verifyTarget = (root, target) => assert.equal(run(root, ["verify", "--test-target", target]).status, 0, `verify ${target}`);

// ---- subject inspection ----------------------------------------------------------------------------

test("inspect rule: governed subjects, modules with test targets, provenance on every relationship", () => {
  const root = project();
  const { status, json } = inspect(root, "RULE-LOY-001");
  assert.equal(status, 0);
  assert.equal(json.subject.id, "RULE-LOY-001");
  assert.equal(json.subject.kind, "business-rule");
  assert.equal(json.subject.status, "active");
  assert.match(json.subject.source, /rules\.md$/);
  assert.deepEqual(json.relationships.governs, [{ id: "alpha#FR-1", kind: "functional-requirement", provenance: "canonical" }]);
  assert.deepEqual(ids(json.modules), [MOD_LOY]);
  assert.deepEqual(json.modules[0].testTargets, [{ id: LOY, provenance: "derived" }]);
  assert.deepEqual(json.relationships.coveredSubjects.map((item) => item.id), ["alpha#AC-1"], "obligations: scenarios covering the governed requirement");
});

test("inspect FR: covering AC, governing rule, verifiedBy scope", () => {
  const root = project();
  const { json } = inspect(root, "alpha#FR-1");
  assert.deepEqual(ids(json.relationships.coveredBy), ["alpha#AC-1"]);
  assert.deepEqual(ids(json.relationships.governedBy), ["RULE-LOY-001"]);
  assert.deepEqual(json.relationships.verifiedBy, [{ id: LOY, provenance: "canonical" }]);
  assert.deepEqual(ids(json.modules), [MOD_LOY]);
});

test("inspect AC: covers its requirement and names its own scope; invariant is governed by its rule", () => {
  const root = project();
  const ac = inspect(root, "alpha#AC-1").json;
  assert.deepEqual(ids(ac.relationships.covers), ["alpha#FR-1"]);
  assert.deepEqual(ac.relationships.verifiedBy.map((item) => item.id), [BIL]);
  const inv = inspect(root, "alpha#INV-1").json;
  assert.deepEqual(ids(inv.relationships.governedBy), ["RULE-LOY-003"]);
});

test("inspect module and test target: reverse relationships, derived and canonical kept apart", () => {
  const root = project();
  const mod = inspect(root, MOD_LOY).json;
  assert.equal(mod.subject.kind, "module");
  assert.deepEqual(ids(mod.relationships.affectedByRules), ["RULE-LOY-001", "RULE-LOY-003"]);
  assert.deepEqual(mod.relationships.testTargets, [{ id: LOY, provenance: "derived" }]);
  const target = inspect(root, LOY).json;
  assert.equal(target.subject.kind, "test-target");
  assert.deepEqual(target.relationships.verifies.map((item) => item.id), ["alpha#FR-1", "alpha#INV-1"], "only subjects that explicitly name the target");
  assert.ok(target.relationships.verifies.every((item) => item.provenance === "canonical"));
  assert.deepEqual(ids(target.relationships.testsModules), [MOD_LOY]);
  assert.equal(target.relationships.testsModules[0].provenance, "derived");
});

test("inspect verification state matches verify --explain (verified, failed, stale, unverified)", () => {
  const root = project();
  assert.equal(run(root, ["verify", "--test-target", LOY]).status, 0);
  write(path.join(root, "packages", "billing", "exit.txt"), "1");
  run(root, ["verify", "--test-target", BIL]); // exits 1: recorded as failed
  const states = {};
  for (const id of ["RULE-LOY-001", "RULE-LOY-002", "alpha#FR-1", "alpha#FR-2", "alpha#AC-1", "alpha#INV-1"]) {
    const explained = JSON.parse(run(root, ["verify", "--explain", id, "--json"]).stdout);
    const { json } = inspect(root, id);
    assert.equal(json.verification.state, explained.verification, id);
    assert.equal(json.verification.reason, explained.reason, id);
    assert.deepEqual(json.verification.gaps, explained.gaps, id);
    states[id] = json.verification.state;
  }
  assert.equal(states["alpha#INV-1"], "verified");
  assert.equal(states["alpha#AC-1"], "failed");
  assert.equal(states["alpha#FR-1"], "failed", "a covering AC failed");
  assert.equal(states["alpha#FR-2"], "unverified", "no verifiedBy scope modeled");
  // stale: edit a governed subject after evidence was recorded
  const edited = YAML.parse(fs.readFileSync(specFile(root), "utf8"));
  edited.invariants[0].statement = "Caches are derived and disposable.";
  write(specFile(root), YAML.stringify(edited));
  const stale = inspect(root, "alpha#INV-1").json;
  assert.equal(stale.verification.state, "stale");
  assert.deepEqual(stale.verification.scopes[0].staleBecause, ["alpha#INV-1"]);
});

test("a subject without a verification scope is unverified with the gap named, and its gate relevance is a warning not a blocker", () => {
  const root = project();
  const { json } = inspect(root, "alpha#FR-2");
  assert.equal(json.verification.state, "unverified");
  assert.match(json.verification.reason, /missing verification scope/);
  assert.deepEqual(json.relationships.verifiedBy, []);
  assert.equal(json.gate.review.status, "allowed");
  assert.ok(json.gate.review.warnings.some((item) => item.code === "coverage-not-modeled"));
});

test("gate relevance of a subject: blocked by its own unexecuted scope, rerun action named", () => {
  const root = project();
  const { json } = inspect(root, "alpha#FR-1");
  assert.equal(json.gate.review.status, "blocked");
  assert.equal(json.gate.release.status, "blocked");
  assert.ok(json.gate.review.blockers.every((blocker) => blocker.rule === "RULE-LOY-001"), "scoped to the rules governing this subject");
  assert.ok(json.gate.review.blockers.some((blocker) => blocker.action === `spectra verify --test-target ${LOY}`));
});

test("unknown ID fails deterministically with a non-zero exit; nothing is fuzzy-matched", () => {
  const root = project();
  for (const id of ["RULE-LOY-999", "alpha#FR-9", "rule-loy-001", "alpha#fr-1", "node:module:packages/nope", "node:dependency:yaml"]) {
    const result = run(root, ["inspect", id]);
    assert.equal(result.status, 1, id);
    assert.match(result.stderr + result.stdout, /Unknown|not an inspectable/i, id);
    assert.equal(result.stdout.includes("verification"), false, id);
  }
});

test("duplicate semantic identity is refused rather than choosing one", () => {
  const root = project();
  fs.appendFileSync(rulesFile(root), "\n## RULE-LOY-001 — Again\n\nDuplicate.\n\nStatus: active\nAffected Modules: loyalty-api\n");
  const result = run(root, ["inspect", "RULE-LOY-001"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /Duplicate/);
});

test("a deleted verifiedBy target is a broken canonical relationship, reported on the subject", () => {
  const root = project();
  write(path.join(root, "packages", "billing", "package.json"), JSON.stringify({ name: "billing" }));
  assert.equal(run(root, ["index"]).status, 0);
  const { json } = inspect(root, "alpha#AC-1");
  assert.ok(json.warnings.some((warning) => warning.code === "broken-canonical-relationship" && warning.target === BIL), JSON.stringify(json.warnings));
  assert.equal(json.gate.review.status, "blocked");
  assert.ok(json.gate.review.blockers.some((blocker) => blocker.code === "broken-canonical-structure"));
});

test("inspect output is byte-identical across repeated runs and names no absolute path or timestamp", () => {
  const root = project({ governsBoth: true });
  verifyTarget(root, LOY);
  for (const args of [["RULE-LOY-001"], ["alpha#FR-1"], [MOD_BIL], [LOY], ["--file", "packages/billing/src/index.js"]]) {
    const first = run(root, ["inspect", ...args, "--json"]).stdout;
    const second = run(root, ["inspect", ...args, "--json"]).stdout;
    assert.equal(first, second, args.join(" "));
    assert.equal(first.includes(root), false, `${args.join(" ")} leaks an absolute path`);
    assert.doesNotMatch(first, /\d{4}-\d\d-\d\dT/);
  }
});

test("human output states the identity, relationships, verification and gate", () => {
  const root = project();
  const result = run(root, ["inspect", "RULE-LOY-001"]);
  assert.equal(result.status, 0);
  for (const expected of ["RULE-LOY-001", "business-rule", "alpha#FR-1", MOD_LOY, "Verification:", "Review gate:"]) assert.ok(result.stdout.includes(expected), expected);
});

// ---- change impact ---------------------------------------------------------------------------------

test("a changed module file reaches the owning module and exactly the rules affecting it, each with a reason", () => {
  const root = project();
  const { status, json } = inspect(root, "--file", "packages/loyalty/src/index.js");
  assert.equal(status, 0);
  assert.deepEqual(json.files, [{ path: "packages/loyalty/src/index.js", module: MOD_LOY }]);
  assert.deepEqual(json.modules, [{ id: MOD_LOY, reason: "contains-changed-file" }]);
  assert.deepEqual(ids(json.rules), ["RULE-LOY-001", "RULE-LOY-003"]);
  assert.ok(json.rules.every((rule) => rule.reasons.includes(`affected-module:${MOD_LOY}`) && rule.direct === false));
  assert.equal(ids(json.rules).includes("RULE-LOY-002"), false, "billing's rule is unrelated to a loyalty file");
});

test("scopes: explicit verifiedBy scopes of impacted subjects, and module test targets as related only", () => {
  const root = project();
  const { json } = inspect(root, "--file", "packages/loyalty/src/index.js");
  const scope = (target) => json.verificationScopes.find((entry) => entry.id === target);
  assert.deepEqual(scope(LOY).reasons.filter((reason) => reason.startsWith("verified-by:")), ["verified-by:alpha#FR-1", "verified-by:alpha#INV-1"]);
  assert.equal(scope(LOY).explicit, true);
  assert.deepEqual(scope(BIL).reasons, ["verified-by:alpha#AC-1"], "AC covering an impacted requirement");
  const only = inspect(root, "--file", "packages/billing/src/index.js").json;
  assert.ok(only.verificationScopes.every((entry) => entry.reasons.length > 0));
  assert.equal(only.verificationScopes.find((entry) => entry.id === LOY), undefined, "no relation through billing");
});

test("a changed feature spec reaches its canonical subjects directly, then the rules governing them", () => {
  const root = project();
  const { json } = inspect(root, "--file", ".spectra/sdd/features/alpha/feature.spec.yaml");
  assert.deepEqual(ids(json.canonicalSubjects), ["alpha#AC-1", "alpha#FR-1", "alpha#FR-2", "alpha#INV-1"]);
  assert.ok(json.canonicalSubjects.every((subject) => subject.reasons.includes("source-file-changed") && subject.direct === true));
  assert.deepEqual(ids(json.rules), ["RULE-LOY-001", "RULE-LOY-002", "RULE-LOY-003"]);
  assert.ok(json.rules.every((rule) => rule.reasons.some((reason) => reason.startsWith("governs-changed-subject:"))));
});

test("a changed business-rule file reaches the rules it defines, directly", () => {
  const root = project();
  const { json } = inspect(root, "--file", ".spectra/sdd/memory-bank/business/loyalty/rules.md");
  assert.deepEqual(ids(json.rules), ["RULE-LOY-001", "RULE-LOY-002", "RULE-LOY-003"]);
  assert.ok(json.rules.every((rule) => rule.direct === true && rule.reasons.includes("source-file-changed")));
});

test("two rules governing one module are both reported", () => {
  const root = project({ governsBoth: true });
  const { json } = inspect(root, "--file", "packages/billing/src/index.js");
  assert.deepEqual(ids(json.rules), ["RULE-LOY-001", "RULE-LOY-002"]);
});

test("root-module file: owned by the root module only; no rule affects it, said explicitly", () => {
  const root = project();
  const { status, json } = inspect(root, "--file", "README.md");
  assert.equal(status, 0);
  assert.equal(json.files[0].module, "node:module:.");
  assert.deepEqual(json.rules, []);
  assert.ok(json.warnings.some((warning) => warning.code === "no-rules-in-scope"));
  assert.equal(json.outcome, "no-rule-impact");
});

test("file outside any known module is reported, not dropped", () => {
  const root = project();
  const index = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "cache", "index", "repo-index.json"), "utf8"));
  assert.ok(index.records.some((record) => record.id === "node:module:."));
  const { json } = inspect(root, "--file", "packages/ghost/src/x.js");
  assert.equal(json.files[0].module, "node:module:.", "the root module owns files no other module contains");
  const noRoot = project();
  fs.rmSync(path.join(noRoot, "package.json"));
  assert.equal(run(noRoot, ["index"]).status, 0);
  const result = inspect(noRoot, "--file", "docs/readme.txt").json;
  assert.equal(result.files[0].module, null);
  assert.ok(result.warnings.some((warning) => warning.code === "file-outside-known-modules" && warning.file === "docs/readme.txt"));
});

test("empty diff is an explicit no-changes outcome, not an unexplained empty impact", () => {
  const root = project();
  const changed = inspect(root, "--changed");
  assert.equal(changed.status, 0);
  assert.equal(changed.json.outcome, "no-changed-files");
  assert.deepEqual(changed.json.files, []);
  const range = inspect(root, "--base", "HEAD");
  assert.equal(range.json.outcome, "no-changed-files");
  assert.match(run(root, ["inspect", "--changed"]).stdout, /No changed files/);
});

test("--changed and --base/--head use the git change set; invalid refs fail instead of returning empty impact", () => {
  const root = project();
  write(path.join(root, "packages", "billing", "src", "index.js"), "module.exports = 2;\n");
  assert.deepEqual(ids(inspect(root, "--changed").json.rules), ["RULE-LOY-002"]);
  commitAll(root);
  assert.equal(inspect(root, "--changed").json.outcome, "no-changed-files");
  const range = inspect(root, "--base", "HEAD~1");
  assert.deepEqual(ids(range.json.rules), ["RULE-LOY-002"]);
  assert.deepEqual(range.json.scope, { kind: "range", base: "HEAD~1", head: "HEAD" });
  for (const args of [["--base", "no-such-ref"], ["--base", "HEAD~1", "--head", "no-such-ref"]]) {
    const result = run(root, ["inspect", ...args]);
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stderr + result.stdout, /Cannot resolve git ref/);
  }
  assert.equal(run(root, ["inspect", "--head", "HEAD"]).status, 1, "--head needs --base");
});

test("outside git, --changed and --base fail explicitly while --file still works", () => {
  const root = project({ withoutGit: true });
  for (const args of [["--changed"], ["--base", "main"]]) {
    const result = run(root, ["inspect", ...args]);
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stderr + result.stdout, /not a git repository/);
  }
  assert.equal(inspect(root, "--file", "packages/billing/src/index.js").status, 0);
});

test("invalid argument combinations fail", () => {
  const root = project();
  for (const args of [[], ["RULE-LOY-001", "--changed"], ["RULE-LOY-001", "--file", "a"], ["--changed", "--file", "a"], ["A", "B"]]) {
    assert.equal(run(root, ["inspect", ...args]).status, 1, args.join(" ") || "(none)");
  }
});

// ---- gate consistency, verification state in impact, read-only --------------------------------------

test("impact and `verify --gate review` agree on the rules and on every blocker/warning for the same range", () => {
  const root = project({ governsBoth: true });
  verifyTarget(root, LOY);
  write(path.join(root, "packages", "billing", "exit.txt"), "1");
  run(root, ["verify", "--test-target", BIL]);
  for (const file of ["packages/billing/src/index.js", "packages/loyalty/src/index.js"]) {
    write(path.join(root, file), `module.exports = ${Math.random()};\n`);
    const gate = JSON.parse(run(root, ["verify", "--gate", "review", "--changed", "--json"]).stdout);
    const { json } = inspect(root, "--changed");
    assert.deepEqual(ids(json.rules), gate.scope.rules, file);
    assert.equal(json.reviewImpact.status, gate.status, file);
    assert.deepEqual(json.reviewImpact.blockers, gate.blockers, file);
    assert.deepEqual(json.reviewImpact.warnings, gate.warnings, file);
    const file2 = inspect(root, "--file", file).json;
    assert.deepEqual(ids(file2.rules), gate.scope.rules, `--file ${file}`);
    commitAll(root);
  }
});

test("impact carries verification state per rule and the release implication", () => {
  const root = project();
  verifyTarget(root, LOY);
  const { json } = inspect(root, "--file", "packages/loyalty/src/index.js");
  const states = Object.fromEntries(json.verificationState.map((entry) => [entry.id, entry.state]));
  assert.equal(states["RULE-LOY-003"], "verified");
  assert.equal(states["RULE-LOY-001"], "unverified", "AC scope has no evidence yet");
  assert.equal(json.reviewImpact.status, "blocked");
  assert.equal(json.releaseImpact.status, "blocked");
  assert.ok(json.releaseImpact.blockersInScope.every((blocker) => ["RULE-LOY-001", "RULE-LOY-003"].includes(blocker.rule)));
  assert.equal(typeof json.releaseImpact.projectBlockers, "number");
  assert.deepEqual(json.gates, undefined);
});

test("impact for an unrelated file explains why a rule is not affected: nothing but the root module owns it", () => {
  const root = project();
  const { json } = inspect(root, "--file", "README.md");
  assert.equal(ids(json.rules).includes("RULE-LOY-001"), false);
  assert.equal(json.reviewImpact.status, "allowed");
  assert.deepEqual(json.reviewImpact.warnings.map((warning) => warning.code), ["no-rules-in-scope"]);
});

test("inspect never runs tests and never writes canonical files, evidence or approvals", () => {
  const root = project();
  verifyTarget(root, LOY);
  const snapshot = () => {
    const out = {};
    const visit = (dir, prefix = "") => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (rel === ".git") continue;
        if (entry.isDirectory()) visit(path.join(dir, entry.name), rel);
        else out[rel] = fs.readFileSync(path.join(dir, entry.name), "utf8");
      }
    };
    visit(root);
    // the Knowledge Map is a disposable derived cache and may be rebuilt on read
    return Object.fromEntries(Object.entries(out).filter(([file]) => !file.startsWith(".spectra/cache/knowledge/")));
  };
  const before = snapshot();
  for (const args of [["RULE-LOY-001"], ["alpha#FR-1"], [MOD_LOY], [LOY], ["--file", "packages/loyalty/src/index.js"], ["--changed"], ["--base", "HEAD"], ["RULE-NOPE"]]) run(root, ["inspect", ...args]);
  assert.deepEqual(snapshot(), before);
});

test("a stale or missing Repo Index is reported, not hidden", () => {
  const root = project();
  write(path.join(root, "packages", "extra", "package.json"), JSON.stringify({ name: "extra" }));
  const stale = inspect(root, "--file", "packages/loyalty/src/index.js").json;
  assert.ok(stale.warnings.some((warning) => warning.code === "repo-index-stale"), JSON.stringify(stale.warnings));
  fs.rmSync(path.join(root, ".spectra", "cache", "index", "repo-index.json"));
  const missing = inspect(root, "--file", "packages/loyalty/src/index.js").json;
  assert.ok(missing.warnings.some((warning) => warning.code === "repo-index-missing"));
});

test("--file resolves relative paths against the working directory and absolute paths through symlinks; outside paths are refused", () => {
  const root = project();
  const nested = path.join(root, "packages", "loyalty");
  const fromNested = run(nested, ["inspect", "--file", "src/index.js", "--json"]);
  assert.equal(fromNested.status, 0, fromNested.stderr);
  assert.deepEqual(JSON.parse(fromNested.stdout).files, [{ path: "packages/loyalty/src/index.js", module: MOD_LOY }]);
  const link = `${root}-link`;
  fs.symlinkSync(root, link);
  const viaLink = run(root, ["inspect", "--file", path.join(link, "packages", "billing", "src", "index.js"), "--json"]);
  assert.equal(viaLink.status, 0, viaLink.stderr);
  assert.equal(JSON.parse(viaLink.stdout).files[0].path, "packages/billing/src/index.js");
  const outside = run(nested, ["inspect", "--file", "../../../outside.js"]);
  assert.equal(outside.status, 1);
  assert.match(outside.stderr + outside.stdout, /outside the project/);
});
