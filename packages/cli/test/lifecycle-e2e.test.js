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

// Compatibility failure modes: invalid or competing authorities, damaged markers,
// unsafe metadata paths, incomplete migrations, alias/target/discovery bypasses,
// and diagnostic commands accidentally loading incompatible governance state.
const inspect = (root, args, env) => spawnSync(process.execPath, ["--input-type=module", "-e",
  `import { inspectProjectCompatibility } from ${JSON.stringify(path.join(cliRoot, "src/lib/project-compatibility.js"))}; console.log(JSON.stringify(inspectProjectCompatibility(process.argv[1])));`, root], { encoding: "utf8", env: { ...process.env, ...env } });
const programmaticInstall = (root, args, env) => spawnSync(process.execPath, ["--input-type=module", "-e",
  `import { installSpectra } from ${JSON.stringify(path.join(cliRoot, "src/lib/install.js"))}; installSpectra({ targetDir: process.argv[1], refresh: true });`, root], { encoding: "utf8", env: { ...process.env, ...env } });
const rejectionCommands = [
  ["init", "."], ["adopt", "."], ["onboard"], ["context"], ["task"], ["route"], ["knowledge"],
  ["check"], ["index"], ["verify"], ["validate"], ["approve"], ["eval"], ["diff"], ["quick"], ["skills"],
  ["adapters", "--agents", "cursor"], ["doctor", "--fix"], ["__update-project"],
  ["context-pack"], ["discuss-task"], ["spec", "diff"], ["eval", "run"], ["skills", "resolve"], ["adapters", "generate", "--agents", "cursor"],
  ...["approve", "eval", "diff", "adapters", "skills", "quick"].map(command => ["admin", command]), ["admin", "doctor", "--fix"]
];
scenario("compatibility commands: every project command and alias rejects newer schema without writes", ({ project, execute, report }) => {
  const root = project(4);
  for (const args of rejectionCommands) {
    const result = execute(root, args); unchanged(report);
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stdout + result.stderr, /TOO_NEW|newer|too.new/i, args.join(" "));
  }
  const result = execute(root, [], programmaticInstall); unchanged(report);
  assert.equal(result.status, 1); assert.match(result.stderr, /TOO_NEW|newer|too.new/i);
});
const invalidStates = [
  ["negative schema", root => setMetadata(root, { schemaVersion: -1 })],
  ["zero schema", root => setMetadata(root, { schemaVersion: 0 })],
  ["unsafe integer schema", root => setMetadata(root, { schemaVersion: Number.MAX_SAFE_INTEGER + 1 })],
  ["fraction schema", root => setMetadata(root, { schemaVersion: 2.5 })],
  ["string schema", root => setMetadata(root, { schemaVersion: "3" })],
  ["missing schema", root => setMetadata(root, { schemaVersion: undefined })],
  ["malformed JSON", root => fs.writeFileSync(path.join(root, ".spectra/install.json"), "{broken")],
  ["array metadata", root => fs.writeFileSync(path.join(root, ".spectra/install.json"), "[]")],
  ["missing manifest", root => fs.unlinkSync(path.join(root, ".spectra/sdd/system/manifest.env"))],
  ["missing metadata", root => fs.unlinkSync(path.join(root, ".spectra/install.json"))],
  ["parallel roots", root => fs.cpSync(path.join(root, ".spectra/sdd"), path.join(root, "spectra/sdd"), { recursive: true })],
  ["secondary malformed authority", root => { fs.mkdirSync(path.join(root, "spectra")); fs.writeFileSync(path.join(root, "spectra/install.json"), "{broken"); }],
  ["config mismatch", root => fs.writeFileSync(path.join(root, ".spectra/config.yaml"), "schemaVersion: 2\ngitMode: local\n")],
  ["config string schema", root => fs.writeFileSync(path.join(root, ".spectra/config.yaml"), 'schemaVersion: "3"\ngitMode: local\n')],
  ["malformed config", root => fs.writeFileSync(path.join(root, ".spectra/config.yaml"), 'schemaVersion: [\n')],
  ["Git mode mismatch", root => fs.writeFileSync(path.join(root, ".spectra/config.yaml"), 'schemaVersion: 3\ngitMode: shared\n')],
  ["invalid Git mode", root => setMetadata(root, { gitMode: "remote" })],
  ["escaping ownership", root => setMetadata(root, { ownedPaths: ["../outside"] })],
  ["escaping docs", root => setMetadata(root, { docsGuidePaths: ["../outside"] })],
  ["incomplete marker", root => fs.writeFileSync(path.join(root, ".spectra/migration.json"), '{"phase":"metadata"}')],
  ["symlink authority", root => { const file = path.join(root, ".spectra/install.json"); const foreign = path.join(runRoot, "foreign-metadata.json"); fs.copyFileSync(file, foreign); fs.unlinkSync(file); fs.symlinkSync(foreign, file); }]
];
function setMetadata(root, values) {
  const file = path.join(root, ".spectra/install.json");
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), ...values }));
}
for (const [name, damage] of invalidStates) scenario(`compatibility ${name}: broken state remains untouched`, ({ project, execute, report }) => {
  const root = project(); damage(root);
  for (const args of [["task"], ["doctor", "--fix"], ["init", "."]]) {
    const result = execute(root, args); unchanged(report); assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /BROKEN|incomplete|conflict|invalid|missing|malformed/i);
  }
  const result = execute(root, [], inspect); unchanged(report); success(result);
  assert.equal(JSON.parse(result.stdout).status, "BROKEN");
});
scenario("compatibility inspection: current and migratable schemas expose stable facts", ({ project, execute, report }) => {
  for (const schema of [1, 2, 3, 4]) {
    const root = project(schema); const result = execute(root, [], inspect); unchanged(report); success(result);
    const facts = JSON.parse(result.stdout);
    assert.equal(facts.status, schema < 3 ? "MIGRATION_REQUIRED" : schema === 3 ? "CURRENT" : "TOO_NEW");
    assert.equal(facts.applicationVersion, source.version); assert.equal(facts.projectSchemaVersion, schema);
    assert.equal(facts.currentSchemaVersion, 3); assert.equal(facts.minimumReadableSchema, 3); assert.equal(facts.maximumReadableSchema, 3);
    assert.equal(facts.layout, "canonical"); assert.equal(facts.migrationAvailable, schema < 3);
    assert.deepEqual(facts.migrationPath, []); // Registry steps are supplied by the migration task.
    assert.equal(typeof facts.reason, "string"); assert.deepEqual(facts.conflicts, []);
    if (schema < 3) { const rejected = execute(root, ["check"]); unchanged(report); assert.equal(rejected.status, 1); assert.match(rejected.stderr, /MIGRATION_REQUIRED|migrat/i); }
  }
});
scenario("compatibility diagnostics: old and new projects report facts without governance writers", ({ project, execute, report }) => {
  for (const schema of [2, 4]) {
    const root = project(schema);
    fs.writeFileSync(path.join(root, ".spectra/sdd/governance/approval-state.yaml"), "unknown future contract: [");
    for (const command of ["status", "doctor"]) {
      const result = execute(root, [command]); unchanged(report);
      assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, schema === 2 ? /MIGRATION_REQUIRED/ : /TOO_NEW/);
    }
  }
});
scenario("compatibility targets: nested upward symlink and adapter destination share preflight", ({ project, execute, report }) => {
  const current = project(); const newer = project(4);
  const nested = path.join(newer, "src/nested"); fs.mkdirSync(nested, { recursive: true });
  const alias = path.join(runRoot, "newer-link"); fs.symlinkSync(newer, alias);
  for (const cwd of [nested, path.join(newer, ".spectra/sdd/system"), alias]) {
    const result = execute(current, ["task", "--cwd", cwd]); unchanged(report);
    assert.equal(result.status, 1); assert.match(result.stderr, /TOO_NEW|newer/i);
  }
  for (const command of ["init", "adopt"]) {
    const result = execute(current, [command, newer]); unchanged(report);
    assert.equal(result.status, 1); assert.match(result.stderr, /TOO_NEW|newer/i);
  }
  for (const args of [["adapters"], ["adapters", "generate"], ["admin", "adapters"]]) {
    const result = execute(current, [...args, "--agents", "cursor", "--target", newer]); unchanged(report);
    assert.equal(result.status, 1); assert.match(result.stderr, /TOO_NEW|newer/i);
  }
  for (const args of [["help"], ["version"], ["task", "--help"]]) { const result = execute(newer, args); unchanged(report); success(result); }
});
scenario("compatibility history: known unversioned legacy differs from missing canonical schema", ({ project, execute, report }) => {
  const root = project();
  fs.renameSync(path.join(root, ".spectra"), path.join(root, "spectra"));
  setLegacyUnversioned(root);
  const result = execute(root, [], inspect); unchanged(report); success(result);
  const facts = JSON.parse(result.stdout); assert.equal(facts.status, "LEGACY_LAYOUT"); assert.equal(facts.projectSchemaVersion, null); assert.equal(facts.migrationAvailable, true);
});
function setLegacyUnversioned(root) {
  const file = path.join(root, "spectra/install.json");
  const metadata = JSON.parse(fs.readFileSync(file, "utf8")); delete metadata.schemaVersion; metadata.cliVersion = "3.0.8"; metadata.runtimeVersion = "3.0.8";
  fs.writeFileSync(file, JSON.stringify(metadata)); fs.writeFileSync(path.join(root, "spectra/config.yaml"), "profile: lite\ngitMode: local\n");
  fs.writeFileSync(path.join(root, "spectra/sdd/system/manifest.env"), "spectra_version=3.0.8\nrepo_mode=consumer\n");
}
scenario("compatibility source guard: source repository remains protected beside stray canonical data", ({ project, execute, report }) => {
  const root = project(); const manifest = path.join(root, "sdd/system/manifest.env"); fs.mkdirSync(path.dirname(manifest), { recursive: true }); fs.writeFileSync(manifest, "repo_mode=canonical\n");
  const result = execute(root, ["init", "."]); unchanged(report); assert.equal(result.status, 1); assert.match(result.stderr, /source repository/);
  const facts = execute(root, [], inspect); unchanged(report); success(facts); assert.equal(JSON.parse(facts.stdout).sourceRepository, true);
});
scenario("compatibility source diagnostics: status and doctor preserve source workflows while installers stay blocked", ({ project, execute, report }) => {
  const root = project();
  fs.renameSync(path.join(root, ".spectra/sdd"), path.join(root, "sdd"));
  fs.rmSync(path.join(root, ".spectra"), { recursive: true });
  const manifest = path.join(root, "sdd/system/manifest.env");
  fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(/^repo_mode=.*$/m, "repo_mode=canonical"));
  const status = execute(root, ["status"]); success(status); assert.match(status.stdout, /Spectra Project Status[\s\S]*Approval State:/);
  const doctor = execute(root, ["doctor"]); unchanged(report); success(doctor); assert.match(doctor.stdout, /Spectra runtime found/); assert.doesNotMatch(doctor.stdout, /Compatibility: BROKEN/);
  for (const args of [["init", "."], ["adopt", "."], ["doctor", "--fix"]]) {
    const rejected = execute(root, args); unchanged(report); assert.equal(rejected.status, 1); assert.match(rejected.stderr, /source repository/i);
  }
});
for (const name of ["install.json", "config.yaml"]) scenario(`compatibility dangling ${name}: broken links cannot authorize a fresh install`, ({ project, execute, report }) => {
  const root = project(); const foreign = project();
  fs.rmSync(path.join(root, ".spectra"), { recursive: true }); fs.mkdirSync(path.join(root, ".spectra"));
  fs.symlinkSync(path.join(foreign, ".spectra", `foreign-${name}`), path.join(root, ".spectra", name));
  const result = execute(root, ["init", "."]); unchanged(report); assert.equal(result.status, 1); assert.match(result.stderr, /BROKEN|symlink/i);
  const inspected = execute(root, [], inspect); unchanged(report); success(inspected); assert.equal(JSON.parse(inspected.stdout).status, "BROKEN");
});
scenario("compatibility overridden help: final false flag cannot bypass preflight", ({ project, execute, report }) => {
  const root = project(4);
  const result = execute(root, ["task", "--help", "--help=false", "--item", "TASK-001", "--task-type", "feature", "--goal", "Unsafe"]);
  unchanged(report); assert.equal(result.status, 1); assert.match(result.stderr, /TOO_NEW|newer/i);
});
scenario("compatibility nested bootstrap: init and adopt cannot write inside a newer parent project", ({ project, execute, report }) => {
  const root = project(4); const nested = path.join(root, "child"); fs.mkdirSync(nested);
  for (const command of ["init", "adopt"]) {
    const result = execute(root, [command, nested]); unchanged(report); assert.equal(result.status, 1); assert.match(result.stderr, /TOO_NEW|newer/i);
  }
});
scenario("compatibility nested symlink: actual project wins over the alias parent", ({ project, execute, report }) => {
  const current = project(); const newer = project(4); const nested = path.join(newer, "src/deep"); fs.mkdirSync(nested, { recursive: true });
  const alias = path.join(current, "linked-directory"); fs.symlinkSync(nested, alias);
  const result = execute(current, ["task", "--cwd", alias, "--item", "TASK-001", "--task-type", "feature", "--goal", "Unsafe"]);
  unchanged(report); assert.equal(result.status, 1); assert.match(result.stderr, /TOO_NEW|newer/i);
});

// Task 3 failures: software update discovers/mutates projects, spawns npx/global
// mutation from a local runtime, hangs on piped stdin, or refresh loses provenance.
scenario("software update independence: all project states and fallback preserve bytes", ({ project, execute, report }) => {
  const roots = [project(), project(2), project(4), project()];
  fs.writeFileSync(path.join(roots[3], ".spectra/install.json"), "{broken");
  const blockedBin = path.join(runRoot, "update-transport"); fs.mkdirSync(blockedBin);
  const calls = path.join(blockedBin, "calls");
  for (const command of ["npm", "npx", "curl"]) fs.writeFileSync(path.join(blockedBin, command), `#!/bin/sh\nprintf '%s\\n' '${command}' >> '${calls}'\nexit 73\n`, { mode: 0o755 });
  const env = { PATH: `${blockedBin}:${process.env.PATH}`, SPECTRA_LATEST_VERSION: "99.0.0" };
  for (const cwd of [runRoot, ...roots]) {
    const current = execute(cwd, ["update", "--yes", "--cwd", roots[3]]); unchanged(report); success(current);
    const newer = execute(cwd, ["update", "--yes"], spectra, env); unchanged(report);
    assert.equal(newer.status, 1); assert.match(newer.stdout + newer.stderr, /install|package.manager|npm/i);
  }
  const local = execute(roots[0], ["update", "--yes"], localSpectra, env); unchanged(report);
  assert.equal(local.status, 1); assert.match(local.stdout + local.stderr, /install|package.manager|npm/i);
  assert.equal(fs.existsSync(calls), false, "local/software update must not spawn mutation transports");
});
scenario("software update confirmation: non-TTY newer update requires explicit yes", ({ project, execute, report }) => {
  const root = project();
  const result = execute(root, ["update"], spectra, { SPECTRA_LATEST_VERSION: "99.0.0" }); unchanged(report);
  assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, /--yes/);
  assert.doesNotMatch(result.stdout + result.stderr, /Continue\?/);
});
scenario("software update internal command: deprecated refresh gives guidance without writes", ({ project, execute, report }) => {
  for (const schema of [2, 3]) {
    const root = project(schema); const result = execute(root, ["__update-project"]); unchanged(report);
    assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, schema === 2 ? /spectra migrate/ : /spectra doctor --fix/);
  }
});
scenario("software update repair provenance: explicit current repair preserves valuable metadata", ({ project, execute, report }) => {
  const root = project(); const file = path.join(root, ".spectra/install.json");
  const initial = JSON.parse(fs.readFileSync(file, "utf8"));
  const original = { ...initial, installedAt: "2001-02-03T04:05:06.000Z", createdWith: "1.2.3", cliVersion: "0.0.1", runtimeVersion: "0.0.1",
    vendorField: { retained: true }, binaryPath: "/unavailable/standalone/spectra", ownedPaths: [...initial.ownedPaths, ".spectra/custom/value"],
    docsGuidePaths: [...initial.docsGuidePaths, "old-guide.md"] };
  fs.writeFileSync(file, JSON.stringify(original));
  fs.unlinkSync(path.join(root, ".spectra/bin/spectra"));
  fs.unlinkSync(path.join(root, ".spectra/sdd/system/runtime/minimal.md"));
  const before = inventory(root);
  const result = execute(root, ["doctor", "--fix"]); success(result);
  const fixed = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of ["installedAt", "createdWith", "vendorField", "installMode", "gitMode", "docsProjectName", "binaryPath"]) assert.deepEqual(fixed[key], original[key], key);
  assert.ok(original.ownedPaths.every(value => fixed.ownedPaths.includes(value))); assert.ok(original.docsGuidePaths.every(value => fixed.docsGuidePaths.includes(value)));
  assert.equal(fixed.cliVersion, source.version); assert.equal(fixed.runtimeVersion, source.version); assert.ok(Number.isFinite(Date.parse(fixed.updatedAt)));
  const after = inventory(root);
  for (const key of [".spectra/sdd/memory-bank/core/projectbrief.md", ".spectra/docs/custom-plugin/plan.md", ".git/info/exclude"]) assert.equal(after[key], before[key], key);
  assert.ok(after[".spectra/bin/spectra"]); assert.ok(after[".spectra/sdd/system/runtime/minimal.md"]);
  delete fixed.createdWith; fs.writeFileSync(file, JSON.stringify(fixed));
  success(execute(root, ["doctor", "--fix"])); assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(file, "utf8")), "createdWith"), false, "repair must not invent creation history");
});
scenario("software update old repair: doctor and bootstrap cannot hide schema migration", ({ project, execute, report }) => {
  const root = project(2);
  for (const args of [["doctor", "--fix"], ["init", "."], ["adopt", "."]]) {
    const result = execute(root, args); unchanged(report); assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, /spectra migrate/);
  }
});

scenario("software update local transport: newer source and fallback never run npx", ({ project, execute, report }) => {
  const root = project(); const bin = path.join(runRoot, "local-update-transport"); fs.mkdirSync(bin);
  const log = path.join(bin, "calls");
  for (const command of ["npm", "npx", "curl"]) fs.writeFileSync(path.join(bin, command), `#!/bin/sh\nprintf '%s\\n' '${command}' >> '${log}'\nexit 73\n`, { mode: 0o755 });
  const env = { PATH: `${bin}:${process.env.PATH}`, SPECTRA_LATEST_VERSION: "99.0.0" };
  for (const invoke of [spectra, localSpectra]) {
    const result = execute(root, ["update", "--yes"], invoke, env); unchanged(report);
    assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, /install|package.manager|npm/i);
  }
  assert.equal(fs.existsSync(log), false, "no update transport may run without installation ownership");
});
scenario("software update creation provenance: fresh bootstrap records its creating release", ({ project }) => {
  const root = project(); assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".spectra/install.json"), "utf8")).createdWith, source.version);
});

// Existing isolated migration entrypoint can reset provenance through the shared
// metadata builder. Verify its real filesystem effects before adapting the caller.
scenario("software update metadata caller: legacy utility preserves original provenance", ({ project, execute }) => {
  const root = project(); fs.renameSync(path.join(root, ".spectra"), path.join(root, "spectra")); setLegacyUnversioned(root);
  const file = path.join(root, "spectra/install.json"); const previous = JSON.parse(fs.readFileSync(file, "utf8"));
  previous.installedAt = "2001-02-03T04:05:06.000Z"; delete previous.createdWith;
  previous.vendorField = { retained: true }; fs.writeFileSync(file, JSON.stringify(previous));
  const migrateUtility = (cwd, args, env) => spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { migrateLegacyLayout } from ${JSON.stringify(path.join(cliRoot, "src/lib/migration.js"))}; console.log(JSON.stringify(migrateLegacyLayout(process.argv[1])));`, cwd], { encoding: "utf8", env: { ...process.env, ...env } });
  success(execute(root, [], migrateUtility));
  const next = JSON.parse(fs.readFileSync(path.join(root, ".spectra/install.json"), "utf8"));
  assert.equal(next.installedAt, previous.installedAt); assert.deepEqual(next.vendorField, previous.vendorField);
  assert.equal(Object.hasOwn(next, "createdWith"), false, "legacy normalization must not invent creation provenance");
});
