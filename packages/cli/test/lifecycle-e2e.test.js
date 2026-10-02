import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { cliRoot, createGitProject, localSpectra, spectra } from "./helpers/project.js";
import { getCliVersion } from "../src/lib/version.js";

// Failure modes: update requires a project or implicitly migrates it; newer schema
// writes; missing/corrupt state is repaired destructively; unsafe uninstall;
// unmanaged fallback pinning breaks; briefs/plugin docs lose value on migration.
// Repeat one case with node --test --test-name-pattern='migration check' <this file>.
// Every case keeps JSON evidence and its fixture roots, including on failure.
const output = process.env.SPECTRA_LIFECYCLE_ARTIFACT_DIR || path.join(os.tmpdir(), "spectra-lifecycle-e2e");
fs.mkdirSync(output, { recursive: true });
const runRoot = fs.mkdtempSync(path.join(output, "run-"));
const source = { version: getCliVersion(), sha: spawnSync("git", ["rev-parse", "HEAD"], { cwd: cliRoot, encoding: "utf8" }).stdout.trim() };
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function inventory(root) {
  const files = {};
  const visit = (dir, prefix = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relative === ".git") continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file, relative);
      else if (entry.isSymbolicLink()) files[relative] = { symlink: fs.readlinkSync(file) };
      else if (entry.isFile()) files[relative] = digest(file);
    }
  };
  visit(root);
  const exclude = path.join(root, ".git/info/exclude");
  if (fs.existsSync(exclude)) files[".git/info/exclude"] = digest(exclude);
  return files;
}
function scenario(name, action) {
  test(name, t => {
    const artifact = path.join(runRoot, `${name.split(":")[0]}.json`);
    const report = { scenario: name, source, projects: [], commands: [], passed: false };
    const roots = [];
    const save = () => fs.writeFileSync(artifact, JSON.stringify(report, null, 2) + "\n");
    t.diagnostic(`Lifecycle artifact: ${artifact}`);
    const execute = (cwd, args, invoke = spectra, env = {}) => {
      const before = roots.map(root => ({ root, files: inventory(root) }));
      const result = invoke(cwd, args, { SPECTRA_LATEST_VERSION: source.version, ...env });
      const after = roots.map(root => ({ root, files: inventory(root) }));
      report.commands.push({ command: [invoke === localSpectra ? "./.spectra/bin/spectra" : "spectra", ...args], cwd,
        exitStatus: result.status, error: result.error?.message, stdout: result.stdout, stderr: result.stderr, before, after,
        regeneratedPaths: after.flatMap((project, i) => Object.keys(project.files).filter(file => JSON.stringify(project.files[file]) !== JSON.stringify(before[i].files[file])).map(file => ({ root: project.root, path: file }))) });
      save();
      return result;
    };
    const project = (schema = 3) => {
      const root = createGitProject(); roots.push(root);
      const metadataPath = path.join(root, ".spectra/install.json");
      const record = { root, sourceVersion: source.version, sourceSha: source.sha, schemaVersion: schema, layout: "canonical", gitMode: "local",
        fixture: "synthetic schema on current bootstrap; historical generation deferred to release matrix",
        authoritativeFiles: [".spectra/install.json", ".spectra/config.yaml", ".spectra/sdd/memory-bank/core/projectbrief.md", ".spectra/docs/custom-plugin/plan.md"] };
      report.projects.push(record);
      success(execute(root, ["init", "."]));
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      metadata.schemaVersion = schema;
      if (schema === 2) metadata.profile = "lite";
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
      const config = path.join(root, ".spectra/config.yaml");
      fs.writeFileSync(config, fs.readFileSync(config, "utf8").replace(/^schemaVersion:.*$/m, `schemaVersion: ${schema}`));
      fs.writeFileSync(path.join(root, ".spectra/sdd/memory-bank/core/projectbrief.md"), "# Project Brief\n\n## Project Name\nLifecycle fixture\n\n## Purpose\nPreserve user intent.\n");
      // Existing policy requires companion templates once a meaningful brief exists.
      for (const name of ["activeContext.md", "progress.md"]) {
        const file = path.join(root, ".spectra/sdd/memory-bank/core", name);
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/<[^>]+>/g, "lifecycle-fixture").replaceAll("YYYY-MM-DD", "2026-10-02"));
      }
      const docs = path.join(root, ".spectra/docs/custom-plugin"); fs.mkdirSync(docs, { recursive: true });
      fs.writeFileSync(path.join(docs, "plan.md"), "# User plugin plan\nPreserve this plan.\n");
      record.initialInventory = inventory(root); save();
      return root;
    };
    try { action({ project, execute, report }); report.passed = true; }
    catch (error) { report.failure = { message: error.message, stack: error.stack }; throw error; }
    finally { save(); }
  });
}
const success = result => assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
function unchanged(report) {
  const command = report.commands.at(-1);
  assert.deepEqual(command.after, command.before, "Project bytes or Git exclusions changed");
}
scenario("outside update: current software preserves two independent projects", ({ project, execute, report }) => {
  project(); project();
  const result = execute(runRoot, ["update", "--yes"]);
  unchanged(report); success(result);
});
scenario("implicit migration: project update must leave schema 2 unchanged", ({ project, execute, report }) => {
  const root = project(2);
  const result = execute(root, ["update", "--yes"]);
  unchanged(report); success(result);
});
scenario("migration check: schema 2 reports migration-required without writes", ({ project, execute, report }) => {
  const result = execute(project(2), ["migrate", "--check", "--json"]);
  unchanged(report); assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).outcome, "migration-required");
});
scenario("value loss: explicit migration preserves value and repeat is a byte no-op", ({ project, execute, report }) => {
  const root = project(2); const before = inventory(root);
  success(execute(root, ["migrate", "--yes"]));
  const after = inventory(root);
  for (const file of [".spectra/sdd/memory-bank/core/projectbrief.md", ".spectra/docs/custom-plugin/plan.md"]) assert.equal(after[file], before[file], file);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".spectra/install.json"), "utf8")).schemaVersion, 3);
  assert.match(fs.readFileSync(path.join(root, ".spectra/config.yaml"), "utf8"), /^schemaVersion: 3$/m);
  const repeat = execute(root, ["migrate", "--yes"]); unchanged(report); success(repeat);
});
scenario("new schema: task command refuses writes to schema 4", ({ project, execute, report }) => {
  const result = execute(project(4), ["task", "--item", "TASK-001", "--task-type", "feature", "--goal", "Unsafe"]);
  unchanged(report); assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, /too.new|newer|incompatible/i);
});
for (const state of ["missing", "corrupt"]) scenario(`${state} state: repair refuses broken authoritative metadata`, ({ project, execute, report }) => {
  const root = project(); const metadata = path.join(root, ".spectra/install.json");
  if (state === "missing") fs.unlinkSync(metadata); else fs.writeFileSync(metadata, "{broken JSON\n");
  const result = execute(root, ["doctor", "--fix"]); unchanged(report); assert.equal(result.status, 1);
});
scenario("unsafe uninstall: project paths never authorize machine deletion", ({ project, execute, report }) => {
  const root = project(); project();
  const foreign = path.join(runRoot, "foreign-machine"); fs.mkdirSync(foreign);
  const executable = path.join(foreign, "spectra"); fs.writeFileSync(executable, "foreign executable\n");
  const metadataPath = path.join(root, ".spectra/install.json"); const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.binaryPath = executable; fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  const before = inventory(foreign);
  const result = execute(runRoot, ["uninstall", "--yes"], spectra, { SPECTRA_HOME: foreign, SPECTRA_BIN: foreign });
  unchanged(report); assert.deepEqual(inventory(foreign), before);
  assert.doesNotMatch(result.stdout + result.stderr, /Unknown command/);
  assert.match(result.stdout + result.stderr, /no managed|unowned|ownership|not.*managed/i);
});
scenario("fallback pinning: standalone stays pinned and Node fallback remains usable", ({ project, execute, report }) => {
  const root = project(); const standalone = path.join(runRoot, "standalone");
  fs.writeFileSync(standalone, '#!/bin/sh\nprintf "standalone-pinned\\n"\n', { mode: 0o755 });
  success(execute(root, ["init", "."], spectra, { SPECTRA_BINARY_PATH: standalone }));
  const pinned = execute(root, ["version"], localSpectra); unchanged(report); success(pinned); assert.match(pinned.stdout, /standalone-pinned/);
  fs.unlinkSync(standalone);
  const fallback = execute(root, ["version"], localSpectra); unchanged(report); success(fallback); assert.ok(fallback.stdout.includes(source.version));
});
