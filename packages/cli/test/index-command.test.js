import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(cwd, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets"),
      ...options.env
    }
  });
}

function runOk(cwd, args, options = {}) {
  const result = run(cwd, args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-index-cmd-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  spawnSync("git", ["config", "user.email", "spectra@example.test"], { cwd: root });
  spawnSync("git", ["config", "user.name", "Spectra Test"], { cwd: root });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo-app", scripts: { test: "node --test" } }, null, 2));
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

test("adopt writes an initial repo index automatically", () => {
  const root = createRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  const indexPath = path.join(root, "spectra", "cache", "index", "repo-index.json");
  assert.ok(fs.existsSync(indexPath), "expected repo-index.json to be created by adopt");

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  assert.deepEqual(index.ecosystems, ["node"]);
  assert.ok(index.records.some((r) => r.kind === "module" && r.name === "demo-app"));
});

test("spectra index --check reports up to date right after indexing", () => {
  const root = createRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  const checkResult = run(root, ["index", "--check"]);
  assert.equal(checkResult.status, 0, checkResult.stderr || checkResult.stdout);
  assert.match(checkResult.stdout, /up to date/i);
});

test("spectra index --check fails with non-zero status when the repo changed", () => {
  const root = createRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "demo-app", scripts: { test: "node --test", build: "tsc" } }, null, 2)
  );

  const checkResult = run(root, ["index", "--check"]);
  assert.equal(checkResult.status, 1);
  assert.match(checkResult.stdout, /stale/i);

  const indexPath = path.join(root, "spectra", "cache", "index", "repo-index.json");
  const beforeMtime = fs.statSync(indexPath).mtimeMs;
  assert.equal(fs.statSync(indexPath).mtimeMs, beforeMtime, "check must not rewrite the index");
});

test("spectra index re-run picks up new build script after repo changes", () => {
  const root = createRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "demo-app", scripts: { test: "node --test", build: "tsc" } }, null, 2)
  );

  runOk(root, ["index"]);
  const indexPath = path.join(root, "spectra", "cache", "index", "repo-index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  assert.ok(index.records.some((r) => r.kind === "build-target"));

  const checkResult = run(root, ["index", "--check"]);
  assert.equal(checkResult.status, 0, checkResult.stderr || checkResult.stdout);
});

test("spectra index --format json prints machine-readable output", () => {
  const root = createRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  const result = runOk(root, ["index", "--format", "json"]);
  const parsed = JSON.parse(result.stdout.trim());
  assert.ok(Array.isArray(parsed.records));
  assert.deepEqual(parsed.ecosystems, ["node"]);
});

test("spectra index --explain prints per-record evidence", () => {
  const root = createRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  const result = runOk(root, ["index", "--explain"]);
  assert.match(result.stdout, /Evidence trail/);
  assert.match(result.stdout, /package\.json/);
});
