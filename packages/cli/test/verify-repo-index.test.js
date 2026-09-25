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

function createProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-verify-index-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  spawnSync("git", ["config", "user.email", "spectra@example.test"], { cwd: root });
  spawnSync("git", ["config", "user.name", "Spectra Test"], { cwd: root });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo-app" }, null, 2));
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "initial"], { cwd: root });
  runOk(root, ["init", ".", "--git-mode", "local"]);
  return root;
}

function repoIndexLine(stdout) {
  return stdout.split("\n").find((line) => line.includes("repo-index:"));
}

test("verify reports the repo index as not built yet before spectra index has run", () => {
  const root = createProject();
  assert.equal(fs.existsSync(path.join(root, ".spectra", "cache", "index", "repo-index.json")), false);

  const result = run(root, ["verify"]);
  const line = repoIndexLine(result.stdout);
  assert.ok(line, `expected a repo-index stage line in:\n${result.stdout}`);
  assert.match(line, /not built yet/);
  assert.doesNotMatch(line, /^FAIL/);
});

test("verify names its shell stage for what it measures and never claims to run project tests", () => {
  const root = createProject();
  const result = run(root, ["verify"]);

  assert.match(result.stdout, /^Spectra Verify$/m);
  assert.doesNotMatch(result.stdout, /Verify v2/);
  assert.doesNotMatch(result.stdout, /^(OK|WARN|FAIL) tests:/m);
  const line = result.stdout.split("\n").find((entry) => entry.includes("verify-work:"));
  assert.ok(line, `expected a verify-work stage line in:\n${result.stdout}`);
  assert.doesNotMatch(line, /legacy/i);
});

test("verify reports the repo index as fresh right after spectra index has run", () => {
  const root = createProject();
  runOk(root, ["index"]);

  const result = run(root, ["verify"]);
  const line = repoIndexLine(result.stdout);
  assert.ok(line, `expected a repo-index stage line in:\n${result.stdout}`);
  assert.match(line, /fresh/);
  assert.match(line, /node/);
  assert.doesNotMatch(line, /^FAIL/);
});

test("verify reports the repo index as stale after a manifest change without re-indexing", () => {
  const root = createProject();
  runOk(root, ["index"]);

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "demo-app", scripts: { build: "tsc" } }, null, 2)
  );

  const result = run(root, ["verify"]);
  const line = repoIndexLine(result.stdout);
  assert.ok(line, `expected a repo-index stage line in:\n${result.stdout}`);
  assert.match(line, /stale, needs refresh/);
  assert.doesNotMatch(line, /^FAIL/);
});

test("the repo-index stage never blocks verify on its own", () => {
  const root = createProject();
  // No spectra index run at all, and no other work done — repo-index stage
  // stays "not built yet" but must never be the reason verify is blocked.
  const result = run(root, ["verify"]);
  const line = repoIndexLine(result.stdout);
  assert.ok(line);
  assert.doesNotMatch(line, /^FAIL/);
});
