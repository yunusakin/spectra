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
  const indexPath = path.join(root, ".spectra", "cache", "index", "repo-index.json");
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

test("e2e: maven-multi-module fixture builds a confirmed parent/child module graph", () => {
  const root = materializeFixture("maven-multi-module");

  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const index = readIndex(root);

  assert.deepEqual(index.ecosystems, ["maven"]);

  const parentModule = index.records.find((r) => r.kind === "module" && r.name === "parent");
  assert.ok(parentModule);
  assert.equal(parentModule.attributes.isParent, true);
  assert.equal(parentModule.confidence, "high");
  assert.equal(parentModule.status, "confirmed");
  assert.equal(parentModule.relationships.dependsOn.length, 2);

  const orderModule = index.records.find((r) => r.kind === "module" && r.name === "order-service");
  assert.ok(orderModule);
  assert.equal(orderModule.path, "services/order");
  assert.equal(orderModule.attributes.parent.artifactId, "parent");

  const commonModule = index.records.find((r) => r.kind === "module" && r.name === "common");
  assert.ok(commonModule);
  assert.equal(commonModule.path, "libs/common");

  const commonDep = index.records.find((r) => r.kind === "dependency" && r.name === "com.acme:common");
  assert.ok(commonDep);

  const springDep = index.records.find(
    (r) => r.kind === "dependency" && r.name === "org.springframework.boot:spring-boot-starter-web"
  );
  assert.ok(springDep);

  const springRuntime = index.records.find((r) => r.kind === "runtime" && r.name === "Spring Boot");
  assert.ok(springRuntime, "expected Spring Boot runtime hint from spring-boot-maven-plugin");

  // This fixture only carries pom.xml files (no src/ tree), so the Maven
  // scanner — which detects a test-target purely from src/test/java
  // presence, not from parsed source content — correctly reports none.
  const testTarget = index.records.find((r) => r.kind === "test-target" && r.name === "order-service:test");
  assert.equal(testTarget, undefined);

  for (const record of index.records) {
    assert.ok(record.evidence.length > 0, `record ${record.id} missing evidence`);
  }

  runOk(root, ["index", "--check"]);

  const explain = runOk(root, ["index", "--explain"]);
  assert.match(explain.stdout, /services\/order\/pom\.xml/);
  assert.match(explain.stdout, /libs\/common\/pom\.xml/);
});

test("e2e: go-workspace fixture reads go.work modules, cmd entrypoints and requires", () => {
  const root = materializeFixture("go-workspace");

  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const index = readIndex(root);

  assert.deepEqual(index.ecosystems, ["go"]);

  const svcModule = index.records.find((r) => r.kind === "module" && r.name === "example.com/svc");
  assert.ok(svcModule);
  assert.equal(svcModule.path, "svc");
  assert.equal(svcModule.confidence, "high");
  assert.equal(svcModule.status, "confirmed");

  const libModule = index.records.find((r) => r.kind === "module" && r.name === "example.com/pkg-lib");
  assert.ok(libModule);
  assert.equal(libModule.path, "pkg-lib");

  const ginDep = index.records.find((r) => r.kind === "dependency" && r.name === "github.com/gin-gonic/gin");
  assert.ok(ginDep);

  const entrypoint = index.records.find((r) => r.kind === "entrypoint" && r.name === "example.com/svc:cmd:server");
  assert.ok(entrypoint);
  assert.equal(entrypoint.path, "svc/cmd/server");

  const testTarget = index.records.find((r) => r.kind === "test-target" && r.name === "example.com/svc:test");
  assert.ok(testTarget);
  assert.equal(testTarget.attributes.testFileCount, 1);

  runOk(root, ["index", "--check"]);

  const explain = runOk(root, ["index", "--explain"]);
  assert.match(explain.stdout, /svc\/go\.mod/);
  assert.match(explain.stdout, /pkg-lib\/go\.mod/);
});

test("e2e: dotnet-solution fixture resolves project references and test/runtime markers", () => {
  const root = materializeFixture("dotnet-solution");

  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const index = readIndex(root);

  assert.deepEqual(index.ecosystems, ["dotnet"]);

  const apiModule = index.records.find((r) => r.kind === "module" && r.name === "Api");
  assert.ok(apiModule);
  assert.equal(apiModule.attributes.outputType, "Exe");
  assert.equal(apiModule.attributes.targetFramework, "net8.0");

  const testModule = index.records.find((r) => r.kind === "module" && r.name === "Api.Tests");
  assert.ok(testModule);
  assert.equal(testModule.attributes.isTestProject, true);
  assert.ok(testModule.relationships.dependsOn.length > 0, "Api.Tests should depend on Api via ProjectReference");

  const testTarget = index.records.find((r) => r.kind === "test-target");
  assert.ok(testTarget);

  const entrypoint = index.records.find((r) => r.kind === "entrypoint");
  assert.ok(entrypoint, "expected an entrypoint for the Exe output type project");

  const aspnetRuntime = index.records.find((r) => r.kind === "runtime" && r.name === "ASP.NET Core");
  assert.ok(aspnetRuntime);

  const testSdkDep = index.records.find((r) => r.kind === "dependency" && r.name === "Microsoft.NET.Test.Sdk");
  assert.ok(testSdkDep);

  runOk(root, ["index", "--check"]);

  const explain = runOk(root, ["index", "--explain"]);
  assert.match(explain.stdout, /Api\.csproj/);
  assert.match(explain.stdout, /Api\.Tests\.csproj/);
});

test("e2e: frontend-simple fixture confirms Next.js via dependency + config file combo", () => {
  const root = materializeFixture("frontend-simple");

  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const index = readIndex(root);

  assert.deepEqual(index.ecosystems, ["node"]);

  const appModule = index.records.find((r) => r.kind === "module" && r.name === "frontend-simple-fixture");
  assert.ok(appModule);

  const buildTarget = index.records.find((r) => r.kind === "build-target");
  assert.equal(buildTarget.attributes.command, "next build");

  const testTarget = index.records.find((r) => r.kind === "test-target");
  assert.equal(testTarget.attributes.command, "jest");

  const nextRuntime = index.records.find((r) => r.kind === "runtime" && r.attributes.framework === "Next.js");
  assert.ok(nextRuntime, "expected Next.js runtime confirmed via dependency + next.config.js");
  assert.equal(nextRuntime.confidence, "high");
  assert.equal(nextRuntime.status, "confirmed");

  runOk(root, ["index", "--check"]);
});
