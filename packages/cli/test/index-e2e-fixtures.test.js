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
const fixturesDir = path.join(testDir, "fixtures");

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

function materializeFixture(fixtureName) {
  const source = path.join(fixturesDir, fixtureName);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `spectra-index-e2e-${fixtureName}-`));
  fs.cpSync(source, root, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: root });
  spawnSync("git", ["config", "user.email", "spectra@example.test"], { cwd: root });
  spawnSync("git", ["config", "user.name", "Spectra Test"], { cwd: root });
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "fixture import"], { cwd: root });
  return root;
}

function readIndex(root) {
  const indexPath = path.join(root, "spectra", "cache", "index", "repo-index.json");
  return JSON.parse(fs.readFileSync(indexPath, "utf8"));
}

test("e2e: node-workspace fixture is adopted and indexed end-to-end", () => {
  const root = materializeFixture("node-workspace");

  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const index = readIndex(root);

  assert.deepEqual(index.ecosystems, ["node"]);

  const apiModule = index.records.find((r) => r.kind === "module" && r.name === "@fixture/api");
  assert.ok(apiModule, "expected @fixture/api module record");
  assert.equal(apiModule.path, "packages/api");
  assert.equal(apiModule.confidence, "high");
  assert.equal(apiModule.status, "confirmed");

  const webModule = index.records.find((r) => r.kind === "module" && r.name === "@fixture/web");
  assert.ok(webModule, "expected @fixture/web module record");

  const apiTest = index.records.find((r) => r.kind === "test-target" && r.name === "@fixture/api:test");
  assert.equal(apiTest.attributes.command, "node --test");

  const webBuild = index.records.find((r) => r.kind === "build-target" && r.name === "@fixture/web:build");
  assert.equal(webBuild.attributes.command, "vite build");

  const expressDep = index.records.find((r) => r.kind === "dependency" && r.name === "express");
  assert.ok(expressDep);

  const viteRuntime = index.records.find((r) => r.kind === "runtime" && r.attributes.framework === "Vite");
  assert.ok(viteRuntime, "expected Vite runtime hint for @fixture/web");
  assert.equal(viteRuntime.confidence, "high");
  assert.equal(viteRuntime.status, "confirmed");

  const reactRuntime = index.records.find((r) => r.kind === "runtime" && r.attributes.framework === "React");
  assert.ok(reactRuntime, "expected React runtime hint from dependency alone");
  assert.equal(reactRuntime.confidence, "medium");
  assert.equal(reactRuntime.status, "candidate");

  const entrypoint = index.records.find((r) => r.kind === "entrypoint" && r.name === "@fixture/api:main");
  assert.equal(entrypoint.path, "packages/api/index.js");

  runOk(root, ["index", "--check"]);

  const explain = runOk(root, ["index", "--explain"]);
  assert.match(explain.stdout, /packages\/api\/package\.json/);
  assert.match(explain.stdout, /packages\/web\/package\.json/);
});

test("e2e: gradle-multi-module fixture is indexed as candidate/low-to-medium confidence heuristics", () => {
  const root = materializeFixture("gradle-multi-module");

  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const index = readIndex(root);

  assert.deepEqual(index.ecosystems, ["gradle"]);

  const rootModule = index.records.find((r) => r.kind === "module" && r.attributes.isRoot);
  assert.ok(rootModule);
  assert.deepEqual(rootModule.attributes.includedProjects.sort(), [":app", ":lib"]);
  assert.equal(rootModule.status, "candidate");

  const appModule = index.records.find((r) => r.kind === "module" && r.attributes.gradlePath === ":app");
  assert.ok(appModule, "expected :app module record");
  assert.equal(appModule.path, "app");
  assert.equal(appModule.status, "candidate");
  assert.ok(["low", "medium"].includes(appModule.confidence));

  const libModule = index.records.find((r) => r.kind === "module" && r.attributes.gradlePath === ":lib");
  assert.ok(libModule, "expected :lib module record");
  assert.equal(libModule.path, "lib");

  const appTestTarget = index.records.find((r) => r.kind === "test-target" && r.name === ":app:test");
  assert.ok(appTestTarget, "expected heuristic test-target for :app (useJUnitPlatform + test block present)");
  assert.equal(appTestTarget.status, "candidate");

  for (const record of index.records) {
    assert.ok(record.evidence.length > 0, `record ${record.id} missing evidence`);
  }

  runOk(root, ["index", "--check"]);

  const explain = runOk(root, ["index", "--explain"]);
  assert.match(explain.stdout, /settings\.gradle\.kts/);
});

