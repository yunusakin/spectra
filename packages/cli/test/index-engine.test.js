import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRepoIndex } from "../src/lib/index/engine.js";

function tmpRepo(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function findRecords(index, predicate) {
  return index.records.filter(predicate);
}

test("index detects unknown ecosystem as low-confidence candidate project", () => {
  const root = tmpRepo("spectra-index-empty-");
  const index = buildRepoIndex(root);
  assert.deepEqual(index.ecosystems, []);
  const project = index.records.find((r) => r.kind === "project");
  assert.equal(project.confidence, "low");
  assert.equal(project.status, "candidate");
});

test("node scanner extracts npm workspace modules, scripts, deps and entrypoints", () => {
  const root = tmpRepo("spectra-index-node-");
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "root-app", private: true, workspaces: ["packages/*"] }, null, 2)
  );
  fs.mkdirSync(path.join(root, "packages", "api"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "packages", "api", "package.json"),
    JSON.stringify(
      {
        name: "@acme/api",
        version: "1.0.0",
        main: "index.js",
        scripts: { test: "node --test", build: "tsc" },
        dependencies: { express: "^4.0.0", react: "^18.0.0" }
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(root, "packages", "api", "vite.config.js"), "export default {};\n");

  const index = buildRepoIndex(root);
  assert.deepEqual(index.ecosystems, ["node"]);

  const apiModule = findRecords(index, (r) => r.kind === "module" && r.name === "@acme/api")[0];
  assert.ok(apiModule);
  assert.equal(apiModule.confidence, "high");
  assert.equal(apiModule.status, "confirmed");
  assert.equal(apiModule.path, "packages/api");
  assert.ok(apiModule.evidence.some((e) => e.file === "packages/api/package.json"));

  const testTarget = findRecords(index, (r) => r.kind === "test-target" && r.name === "@acme/api:test")[0];
  assert.ok(testTarget);
  assert.equal(testTarget.attributes.command, "node --test");

  const buildTarget = findRecords(index, (r) => r.kind === "build-target")[0];
  assert.equal(buildTarget.attributes.command, "tsc");

  const entrypoint = findRecords(index, (r) => r.kind === "entrypoint")[0];
  assert.equal(entrypoint.path, "packages/api/index.js");

  const expressDep = findRecords(index, (r) => r.kind === "dependency" && r.name === "express")[0];
  assert.ok(expressDep);
  assert.equal(expressDep.confidence, "high");

  const reactRuntime = findRecords(index, (r) => r.kind === "runtime" && r.attributes.framework === "React")[0];
  assert.ok(reactRuntime);
  assert.equal(reactRuntime.confidence, "medium");
  assert.equal(reactRuntime.status, "candidate");
});

test("go scanner reads go.work modules, cmd entrypoints and require dependencies", () => {
  const root = tmpRepo("spectra-index-go-");
  fs.writeFileSync(path.join(root, "go.work"), "go 1.22\n\nuse (\n\t./svc\n)\n");
  const svcDir = path.join(root, "svc");
  fs.mkdirSync(svcDir, { recursive: true });
  fs.writeFileSync(
    path.join(svcDir, "go.mod"),
    "module example.com/svc\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n"
  );
  fs.mkdirSync(path.join(svcDir, "cmd", "server"), { recursive: true });
  fs.writeFileSync(path.join(svcDir, "cmd", "server", "main.go"), "package main\n\nfunc main() {}\n");
  fs.writeFileSync(path.join(svcDir, "svc_test.go"), "package svc\n");

  const index = buildRepoIndex(root);
  assert.deepEqual(index.ecosystems, ["go"]);

  const moduleRecord = findRecords(index, (r) => r.kind === "module")[0];
  assert.equal(moduleRecord.name, "example.com/svc");
  assert.equal(moduleRecord.confidence, "high");

  const dep = findRecords(index, (r) => r.kind === "dependency" && r.name === "github.com/gin-gonic/gin")[0];
  assert.ok(dep);

  const entrypoint = findRecords(index, (r) => r.kind === "entrypoint")[0];
  assert.equal(entrypoint.path, "svc/cmd/server");

  const testTarget = findRecords(index, (r) => r.kind === "test-target")[0];
  assert.equal(testTarget.attributes.testFileCount, 1);
});

test("maven scanner builds parent/child module graph from multi-module pom.xml", () => {
  const root = tmpRepo("spectra-index-maven-");
  fs.writeFileSync(
    path.join(root, "pom.xml"),
    `<?xml version="1.0"?>
<project>
  <groupId>com.acme</groupId>
  <artifactId>parent</artifactId>
  <version>1.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>services/order</module>
    <module>libs/common</module>
  </modules>
</project>`
  );
  fs.mkdirSync(path.join(root, "services", "order"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "services", "order", "pom.xml"),
    `<project>
  <parent>
    <groupId>com.acme</groupId>
    <artifactId>parent</artifactId>
    <version>1.0.0</version>
  </parent>
  <artifactId>order-service</artifactId>
  <dependencies>
    <dependency>
      <groupId>com.acme</groupId>
      <artifactId>common</artifactId>
      <version>1.0.0</version>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>`
  );
  fs.mkdirSync(path.join(root, "services", "order", "src", "test", "java"), { recursive: true });
  fs.mkdirSync(path.join(root, "libs", "common"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "libs", "common", "pom.xml"),
    `<project>
  <parent>
    <groupId>com.acme</groupId>
    <artifactId>parent</artifactId>
    <version>1.0.0</version>
  </parent>
  <artifactId>common</artifactId>
</project>`
  );

  const index = buildRepoIndex(root);
  assert.deepEqual(index.ecosystems, ["maven"]);

  const parentModule = findRecords(index, (r) => r.kind === "module" && r.name === "parent")[0];
  assert.equal(parentModule.attributes.isParent, true);
  assert.equal(parentModule.relationships.dependsOn.length, 2);

  const orderModule = findRecords(index, (r) => r.kind === "module" && r.name === "order-service")[0];
  assert.equal(orderModule.attributes.parent.artifactId, "parent");
  assert.equal(orderModule.confidence, "high");

  const commonDep = findRecords(index, (r) => r.kind === "dependency" && r.name === "com.acme:common")[0];
  assert.ok(commonDep);

  const testTarget = findRecords(index, (r) => r.kind === "test-target" && r.name === "order-service:test")[0];
  assert.ok(testTarget);

  const runtime = findRecords(index, (r) => r.kind === "runtime" && r.name === "Spring Boot")[0];
  assert.ok(runtime);
});

test("dotnet scanner reads solution projects, references and test markers", () => {
  const root = tmpRepo("spectra-index-dotnet-");
  fs.writeFileSync(
    path.join(root, "App.sln"),
    `Microsoft Visual Studio Solution File, Format Version 12.00\n` +
      `Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Api", "src\\Api\\Api.csproj", "{GUID1}"\n` +
      `EndProject\n` +
      `Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Api.Tests", "test\\Api.Tests\\Api.Tests.csproj", "{GUID2}"\n` +
      `EndProject\n`
  );
  fs.mkdirSync(path.join(root, "src", "Api"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "Api", "Api.csproj"),
    `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <OutputType>Exe</OutputType>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.App" Version="8.0.0" />
  </ItemGroup>
</Project>`
  );
  fs.mkdirSync(path.join(root, "test", "Api.Tests"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "test", "Api.Tests", "Api.Tests.csproj"),
    `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <ProjectReference Include="..\\..\\src\\Api\\Api.csproj" />
  </ItemGroup>
</Project>`
  );

  const index = buildRepoIndex(root);
  assert.deepEqual(index.ecosystems, ["dotnet"]);

  const apiModule = findRecords(index, (r) => r.kind === "module" && r.name === "Api")[0];
  assert.equal(apiModule.attributes.outputType, "Exe");

  const testModule = findRecords(index, (r) => r.kind === "module" && r.name === "Api.Tests")[0];
  assert.equal(testModule.attributes.isTestProject, true);
  assert.ok(testModule.relationships.dependsOn.length > 0);

  const testTarget = findRecords(index, (r) => r.kind === "test-target")[0];
  assert.ok(testTarget);

  const runtime = findRecords(index, (r) => r.kind === "runtime" && r.name === "ASP.NET Core")[0];
  assert.ok(runtime);
});

test("python scanner marks setup.py-only projects as low-confidence candidates", () => {
  const root = tmpRepo("spectra-index-python-");
  fs.writeFileSync(path.join(root, "setup.py"), "from setuptools import setup\nsetup(name='demo')\n");
  fs.writeFileSync(path.join(root, "requirements.txt"), "flask==3.0.0\nrequests>=2.0\n");

  const index = buildRepoIndex(root);
  assert.deepEqual(index.ecosystems, ["python"]);

  const moduleRecord = findRecords(index, (r) => r.kind === "module")[0];
  assert.equal(moduleRecord.confidence, "low");
  assert.equal(moduleRecord.status, "candidate");

  const flaskDep = findRecords(index, (r) => r.kind === "dependency" && r.name === "flask")[0];
  assert.ok(flaskDep);
  assert.equal(flaskDep.confidence, "high");
});

test("python scanner promotes pyproject-declared name to a confirmed module", () => {
  const root = tmpRepo("spectra-index-python-pyproject-");
  fs.writeFileSync(
    path.join(root, "pyproject.toml"),
    `[project]\nname = "demo-service"\ndependencies = ["flask>=3.0"]\n\n[project.scripts]\ndemo = "demo.cli:main"\n`
  );

  const index = buildRepoIndex(root);
  const moduleRecord = findRecords(index, (r) => r.kind === "module")[0];
  assert.equal(moduleRecord.name, "demo-service");
  assert.equal(moduleRecord.confidence, "high");
  assert.equal(moduleRecord.status, "confirmed");

  const entrypoint = findRecords(index, (r) => r.kind === "entrypoint")[0];
  assert.equal(entrypoint.name, "demo-service:demo");
});

test("index is deterministic across repeated builds", () => {
  const root = tmpRepo("spectra-index-deterministic-");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo" }, null, 2));
  const first = buildRepoIndex(root);
  const second = buildRepoIndex(root);
  assert.deepEqual(
    first.records.map((r) => r.id),
    second.records.map((r) => r.id)
  );
  assert.equal(first.signature.hash, second.signature.hash);
});

test("every record carries evidence and a valid confidence/status pair", () => {
  const root = tmpRepo("spectra-index-shape-");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "demo", dependencies: { lodash: "^4.0.0" } }, null, 2));
  const index = buildRepoIndex(root);
  for (const record of index.records) {
    assert.ok(Array.isArray(record.evidence) && record.evidence.length > 0, `record ${record.id} missing evidence`);
    assert.ok(["high", "medium", "low"].includes(record.confidence));
    assert.ok(["confirmed", "candidate"].includes(record.status));
  }
});
