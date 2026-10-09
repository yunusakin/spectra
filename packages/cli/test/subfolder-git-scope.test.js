// Changed-file scope when the Spectra project lives below the Git root (monorepo subfolder). Failure modes
// this file exists to catch (written before the fix):
//  - git reports repository-root-relative paths (`service/packages/loyalty/...`), so the file matches no module and
//    `inspect --changed` / `--base` answer no-rule-impact
//  - the review gate then scopes zero rules and answers `allowed` for a change that concerns a rule
//  - a change in a sibling directory outside the project leaks into the project's changed scope
//  - Spectra's own `.spectra/` paths stop being recognised (prefix `service/.spectra/`) and count as application source
//  - an ordinary repository (Git root == project root) changes behaviour
//  - an unresolvable ref is swallowed instead of failing closed with `invalid-ref`
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, "utf8"); };
const git = (root, ...args) => assert.equal(spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root }).status, 0, args.join(" "));
const json = (cwd, args) => { const r = run(cwd, [...args, "--json"]); return { status: r.status, doc: JSON.parse(r.stdout) }; };

const MODULE = "node:module:packages/loyalty";
const SOURCE = "packages/loyalty/src/index.js";

// `sub` is the project folder below the Git root ("" = project root is the Git root).
function fixture(sub) {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-subfolder-")));
  const project = path.join(repo, sub);
  git(repo, "init", "-q");
  write(path.join(repo, "sibling", "other.js"), "module.exports = 0;\n");
  write(path.join(project, "package.json"), JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }));
  write(path.join(project, "packages", "loyalty", "package.json"), JSON.stringify({ name: "loyalty", scripts: { test: "node -e 0" } }));
  write(path.join(project, SOURCE), "module.exports = 1;\n");
  assert.equal(run(project, ["init", ".", "--git-mode", "shared"]).status, 0);
  const sdd = path.join(project, ".spectra", "sdd");
  write(path.join(sdd, "memory-bank", "tech", "modules.md"), "# Technical Module Index\n\n| Module | Responsibility | Paths | Business Domains |\n| --- | --- | --- | --- |\n| loyalty-api | Loyalty | packages/loyalty/ | loyalty |\n");
  write(path.join(sdd, "memory-bank", "business", "INDEX.md"), "# Business Domain Index\n\n| Domain | Keywords | Rules | Unresolved | Related Modules |\n| --- | --- | --- | --- | --- |\n| loyalty | points | business/loyalty/rules.md | business/loyalty/unresolved.md | loyalty-api |\n");
  write(path.join(sdd, "memory-bank", "business", "loyalty", "rules.md"), "# Rules\n\n## RULE-LOY-001 — Expiration\n\nExpired points cannot pay for orders.\n\nStatus: active\nAffected Modules: loyalty-api\n");
  write(path.join(sdd, "memory-bank", "business", "loyalty", "unresolved.md"), "# U\n");
  assert.equal(run(project, ["index"]).status, 0);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  return { repo, project };
}

for (const sub of ["", "service"]) {
  const label = sub ? "project below the Git root" : "project at the Git root";

  test(`inspect --changed: ${label} gets project-relative files, the module and the rule`, () => {
    const { project } = fixture(sub);
    write(path.join(project, SOURCE), "module.exports = 2;\n");
    const { status, doc } = json(project, ["inspect", "--changed"]);
    assert.equal(status, 0);
    assert.deepEqual(doc.files, [{ path: SOURCE, module: MODULE }]);
    assert.equal(doc.outcome, "impact");
    assert.deepEqual(doc.rules.map((rule) => rule.id), ["RULE-LOY-001"]);
  });

  test(`inspect --base: ${label} gets the same impact from a committed change`, () => {
    const { repo, project } = fixture(sub);
    write(path.join(project, SOURCE), "module.exports = 2;\n");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "change");
    const { status, doc } = json(project, ["inspect", "--base", "HEAD~1", "--head", "HEAD"]);
    assert.equal(status, 0);
    assert.deepEqual(doc.files, [{ path: SOURCE, module: MODULE }]);
    assert.deepEqual(doc.rules.map((rule) => rule.id), ["RULE-LOY-001"]);
  });

  test(`review gate --changed: ${label} scopes the rule the change concerns`, () => {
    const { project } = fixture(sub);
    write(path.join(project, SOURCE), "module.exports = 2;\n");
    const { doc } = json(project, ["verify", "--gate", "review", "--changed"]);
    assert.deepEqual(doc.scope, { kind: "changed", rules: ["RULE-LOY-001"] });
  });

  test(`${label}: an untracked source file is project-relative too`, () => {
    const { project } = fixture(sub);
    write(path.join(project, "packages", "loyalty", "src", "new.js"), "module.exports = 3;\n");
    const { doc } = json(project, ["inspect", "--changed"]);
    assert.deepEqual(doc.files, [{ path: "packages/loyalty/src/new.js", module: MODULE }]);
  });

  test(`${label}: an unresolvable ref still fails closed`, () => {
    const { project } = fixture(sub);
    const { status, doc } = json(project, ["inspect", "--base", "no-such-ref"]);
    assert.equal(status, 1);
    assert.equal(doc.error.code, "invalid-ref");
  });
}

test("a change outside the project folder is not part of the project's changed scope", () => {
  const { repo, project } = fixture("service");
  write(path.join(repo, "sibling", "other.js"), "module.exports = 9;\n");
  const changed = json(project, ["inspect", "--changed"]).doc;
  assert.equal(changed.outcome, "no-changed-files");
  assert.deepEqual(changed.files ?? [], []);
  assert.deepEqual(json(project, ["verify", "--gate", "review", "--changed"]).doc.scope, { kind: "changed", rules: [] });
});

test("Spectra's own files below the Git root keep their canonical/derived distinction", () => {
  const { project } = fixture("service");
  write(path.join(project, ".spectra", "sdd", "memory-bank", "core", "progress.md"), "# progress changed\n");
  write(path.join(project, ".spectra", "sdd", "memory-bank", "business", "loyalty", "rules.md"), "# Rules\n\n## RULE-LOY-001 — Expiration\n\nExpired points cannot pay for orders.\n\nStatus: active\nAffected Modules: loyalty-api\nConfidence: high\n");
  const { doc } = json(project, ["inspect", "--changed"]);
  assert.deepEqual(doc.files.map((file) => file.path), ["sdd/memory-bank/business/loyalty/rules.md"], "bookkeeping is ignored, a canonical rule file counts, and both are data-root-relative");
});

test("context --changed resolves the changed file's module for a project below the Git root", () => {
  const { project } = fixture("service");
  write(path.join(project, SOURCE), "module.exports = 2;\n");
  const result = run(project, ["context", "--route-task", "Check the change", "--changed", "--format", "json"]);
  assert.equal(result.status, 0);
  assert.ok(JSON.parse(result.stdout).entries.some((entry) => entry.knowledgeId === MODULE && entry.reasons.some(({ reason }) => reason === "changed-file")), "the changed file selects its own module");
});

test("an approval is invalidated by a spec change in a project below the Git root", () => {
  const { repo, project } = fixture("service");
  write(path.join(project, ".spectra", "sdd", "memory-bank", "core", "projectbrief.md"), "# Project Brief\n\n## Problem\nUsers need a flow.\n\n## Outcome\nGoverned delivery.\n\n## Scope\nCore.\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "brief");
  assert.equal(run(project, ["approve", "--stage", "product-approved"]).status, 0);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "approved");
  const spec = path.join(project, ".spectra", "sdd", "features", "spectra-core", "feature.spec.yaml");
  fs.writeFileSync(spec, fs.readFileSync(spec, "utf8").replace(/^ {2}problem:.*$/m, "  problem: A different problem statement"));
  const { doc } = json(project, ["status"]);
  assert.deepEqual(doc.approval.invalidations.map((entry) => entry.stage), ["product-approved"]);
});
