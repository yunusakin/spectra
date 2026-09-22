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

function createGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-context-repo-index-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  spawnSync("git", ["config", "user.email", "spectra@example.test"], { cwd: root });
  spawnSync("git", ["config", "user.name", "Spectra Test"], { cwd: root });
  return root;
}

test("context pack reports the repo index unavailable before spectra index has run", () => {
  const root = createGitRepo();
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo" }, null, 2));
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "initial"], { cwd: root });

  runOk(root, ["init", "."]);

  const jsonResult = runOk(root, ["context", "--role", "planner", "--goal", "discover", "--format", "json"]);
  const pack = JSON.parse(jsonResult.stdout.trim());
  assert.equal(pack.repoIndex.available, false);

  const refsResult = runOk(root, ["context", "--role", "planner", "--goal", "discover"]);
  assert.match(refsResult.stdout, /Repo Index:/);
  assert.match(refsResult.stdout, /Not available yet/);
});

test("context pack surfaces module/ecosystem data once spectra index has run", () => {
  const root = createGitRepo();
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "demo-app", scripts: { test: "node --test" } }, null, 2)
  );
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "initial"], { cwd: root });

  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  const jsonResult = runOk(root, ["context", "--role", "planner", "--goal", "discover", "--format", "json"]);
  const pack = JSON.parse(jsonResult.stdout.trim());

  assert.equal(pack.repoIndex.available, true);
  assert.deepEqual(pack.repoIndex.ecosystems, ["node"]);
  assert.ok(pack.repoIndex.modules.some((m) => m.name === "demo-app"));
  assert.ok(pack.repoIndex.stats.byKind.module >= 1);

  const refsResult = runOk(root, ["context", "--role", "planner", "--goal", "discover"]);
  assert.match(refsResult.stdout, /Repo Index:/);
  assert.match(refsResult.stdout, /Ecosystems: node/);

  // Budget accounting must stay untouched by the repo index bridge.
  assert.match(refsResult.stdout, /Estimated Tokens: \d+/);
});

test("context pack budget warnings are unaffected by repo index presence", () => {
  // Same adopted project (identical memory-bank state), compared with and
  // without the cached repo index: the index bridge must never change the
  // token budget accounting.
  const root = createGitRepo();
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo" }, null, 2));
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "initial"], { cwd: root });
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  const withIndex = runOk(root, ["context", "--role", "planner", "--goal", "discover"]);

  const indexCacheDir = path.join(root, ".spectra", "cache", "index");
  fs.rmSync(indexCacheDir, { recursive: true, force: true });
  const withoutIndex = runOk(root, ["context", "--role", "planner", "--goal", "discover"]);

  const tokenLine = (stdout) => stdout.split("\n").find((line) => line.includes("Estimated Tokens:"));
  assert.match(withIndex.stdout, /Repo Index:/);
  assert.ok(tokenLine(withIndex.stdout));
  assert.equal(tokenLine(withIndex.stdout), tokenLine(withoutIndex.stdout));
});
