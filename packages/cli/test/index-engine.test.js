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

test("node scanner indexes devDependencies and frontend runtime hints from dev tooling", () => {
  const root = tmpRepo("spectra-index-node-devdeps-");
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "web-app",
        scripts: { build: "vite build" },
        dependencies: { react: "^18.0.0" },
        devDependencies: { vite: "^5.0.0" }
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(root, "vite.config.js"), "export default {};\n");

  const index = buildRepoIndex(root);

  const viteDep = findRecords(index, (r) => r.kind === "dependency" && r.name === "vite")[0];
  assert.ok(viteDep);
  assert.equal(viteDep.attributes.dev, true);
  assert.ok(viteDep.evidence.some((e) => e.field === "devDependencies.vite"));

  const viteRuntime = findRecords(index, (r) => r.kind === "runtime" && r.attributes.framework === "Vite")[0];
  assert.ok(viteRuntime);
  assert.equal(viteRuntime.confidence, "high");
  assert.equal(viteRuntime.status, "confirmed");
});

test("gradle scanner indexes single-module builds without settings.gradle", () => {
  const root = tmpRepo("spectra-index-gradle-single-");
  fs.writeFileSync(
    path.join(root, "build.gradle.kts"),
    "plugins { java }\n\ntasks.test { useJUnitPlatform() }\n"
  );

  const index = buildRepoIndex(root);
  assert.deepEqual(index.ecosystems, ["gradle"]);

  const moduleRecord = findRecords(index, (r) => r.kind === "module" && r.path === ".")[0];
  assert.ok(moduleRecord);
  assert.equal(moduleRecord.confidence, "medium");
  assert.equal(moduleRecord.status, "candidate");
  assert.ok(moduleRecord.evidence.some((e) => e.file === "build.gradle.kts"));

  const testTarget = findRecords(index, (r) => r.kind === "test-target")[0];
  assert.ok(testTarget);
  assert.equal(testTarget.path, ".");
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
