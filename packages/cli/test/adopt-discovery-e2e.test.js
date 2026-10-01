import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createGitProject, git, localSpectra, spectra } from "./helpers/project.js";

// Failure cases: manifest evidence never reaches discovery; conventional paths
// are presented as facts; test commands execute during adopt; unsupported or
// malformed manifests leave empty sections; Spectra files pollute discovery;
// repeat adoption duplicates evidence or invents business responsibilities.
function write(root, name, content) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function adopt(root, invoke = spectra) {
  const result = invoke(root, ["adopt", "."]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const memory = path.join(root, ".spectra/sdd/memory-bank");
  const documents = Object.fromEntries(["stack", "architecture", "structure", "conventions", "testing", "integrations", "concerns"].map(name =>
    [name, fs.readFileSync(path.join(memory, "discovery", `${name}.md`), "utf8")]));
  write(root, ".spectra/cache/discovery-e2e.json", JSON.stringify({ documents, modules: fs.readFileSync(path.join(memory, "tech/modules.md"), "utf8") }, null, 2));
  return documents;
}

test("adopt discovery uses Maven module/source/test evidence and keeps repeatable artifacts", t => {
  const root = createGitProject();
  fs.unlinkSync(path.join(root, "package.json"));
  write(root, "pom.xml", '<project><artifactId>platform</artifactId><packaging>pom</packaging><modules><module>service</module></modules></project>');
  write(root, "service/pom.xml", '<project><artifactId>service</artifactId><dependencies><dependency><groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><scope>test</scope></dependency></dependencies></project>');
  write(root, "service/src/main/java/App.java", "class App {}\n");
  write(root, "service/src/test/java/AppTest.java", "class AppTest {}\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "Maven fixture");
  const docs = adopt(root);
  assert.match(docs.architecture, /service\/src\/main\/java/);
  assert.match(docs.architecture, /service\/pom.xml/);
  assert.match(docs.architecture, /Unconfirmed/);
  assert.match(docs.testing, /mvn test/);
  assert.match(docs.testing, /junit-jupiter/);
  assert.match(docs.testing, /Coverage.*not measured/i);
  const modules = fs.readFileSync(path.join(root, ".spectra/sdd/memory-bank/tech/modules.md"), "utf8");
  assert.match(modules, /platform/);
  assert.match(modules, /responsibility unconfirmed/i);
  assert.equal(git(root, "status", "--porcelain").trim(), "");
  assert.deepEqual(adopt(root, localSpectra), docs);
  t.diagnostic(`Repeatable artifact: ${root}/.spectra/cache/discovery-e2e.json`);
});

test("adopt discovery projects Node workspace commands without executing them", t => {
  const root = createGitProject();
  write(root, "package.json", JSON.stringify({ name: "platform", workspaces: ["packages/*"] }));
  write(root, "packages/api/package.json", JSON.stringify({ name: "api", scripts: { test: "touch TESTS_EXECUTED && vitest run", lint: "eslint src" }, devDependencies: { vitest: "^1", eslint: "^9" } }));
  write(root, "packages/api/src/app.js", "export const app = true;\n");
  const docs = adopt(root);
  assert.match(docs.architecture, /packages\/api/);
  assert.match(docs.testing, /vitest run/);
  assert.match(docs.testing, /packages\/api\/package.json/);
  assert.match(docs.conventions, /eslint src/);
  assert.equal(fs.existsSync(path.join(root, "TESTS_EXECUTED")), false);
  assert.equal(fs.existsSync(path.join(root, "packages/api/TESTS_EXECUTED")), false);
  assert.doesNotMatch(fs.readFileSync(path.join(root, ".spectra/sdd/memory-bank/business/INDEX.md"), "utf8"), /\| api \|/);
  t.diagnostic(`Repeatable artifact: ${root}/.spectra/cache/discovery-e2e.json`);
});

test("adopt discovery explicitly reports unsupported signals and tolerates index failures", t => {
  const root = createGitProject();
  fs.unlinkSync(path.join(root, "package.json"));
  const docs = adopt(root);
  for (const name of ["stack", "architecture", "conventions", "integrations"]) {
    assert.match(docs[name], /No .*signals detected/i, `${name} must explain missing evidence`);
  }
  write(root, "package.json", "{broken");
  const result = spectra(root, ["adopt", "."]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout + result.stderr, /Repo indexing failed/);
  const architecture = fs.readFileSync(path.join(root, ".spectra/sdd/memory-bank/discovery/architecture.md"), "utf8");
  assert.match(architecture, /unavailable|failed/i);
  t.diagnostic(`Repeatable artifact: ${root}/.spectra/sdd/memory-bank/discovery/architecture.md`);
});

// Failure cases: unnamed root packages lose their routable identity; nested
// Maven overrides resolve at the repository root; property paths claim certainty.
test("unnamed Node packages retain a routable module identity", t => {
  const root = createGitProject();
  write(root, "package.json", JSON.stringify({ private: true }));
  write(root, "src/app.js", "export const app = true;\n");
  adopt(root);
  const name = path.basename(root).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const routed = localSpectra(root, ["route", "--task", "inspect", "--module", name]);
  assert.equal(routed.status, 0, routed.stderr || routed.stdout);
  assert.match(fs.readFileSync(path.join(root, ".spectra/sdd/memory-bank/tech/modules.md"), "utf8"), new RegExp(`\\| ${name} \\|`));
  t.diagnostic(`Repeatable artifact: ${root}/.spectra/cache/discovery-e2e.json`);
});

test("nested Maven source overrides resolve relative to their module", t => {
  const root = createGitProject();
  fs.unlinkSync(path.join(root, "package.json"));
  write(root, "pom.xml", '<project><artifactId>platform</artifactId><modules><module>service</module><module>dynamic</module></modules></project>');
  write(root, "service/pom.xml", '<project><artifactId>service</artifactId><build><sourceDirectory>sources</sourceDirectory><testSourceDirectory>tests</testSourceDirectory></build></project>');
  write(root, "dynamic/pom.xml", '<project><artifactId>dynamic</artifactId><build><sourceDirectory>${custom.sources}</sourceDirectory></build></project>');
  write(root, "service/sources/App.java", "class App {}\n");
  write(root, "service/tests/AppTest.java", "class AppTest {}\n");
  const docs = adopt(root);
  assert.match(docs.architecture, /main source root: service\/sources \[confirmed, confidence=high; exists\]/);
  assert.match(docs.architecture, /test source root: service\/tests \[confirmed, confidence=high; exists\]/);
  assert.match(docs.architecture, /\$\{custom.sources\} \[candidate, confidence=low/);
  assert.match(docs.testing, /service:test/);
  assert.match(docs.testing, /mvn test/);
  t.diagnostic(`Repeatable artifact: ${root}/.spectra/cache/discovery-e2e.json`);
});
