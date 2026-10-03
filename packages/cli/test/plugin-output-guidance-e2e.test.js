import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createGitProject, localSpectra, spectra } from "./helpers/project.js";

// Failure cases: guidance absent from installed adapters, vendor-specific
// policy, missing compatibility exceptions, broken entrypoint paths, unsafe
// plugin names, user-owned adapters overwritten, regeneration loses policy.
test("installed adapters share generic plugin output guidance and preserve user files", t => {
  const initial = createGitProject();
  const root = path.join(initial, "acme");
  const temporary = `${initial}-moving`;
  fs.renameSync(initial, temporary);
  fs.mkdirSync(initial);
  fs.renameSync(temporary, root);
  const agents = "codex,claude,cursor,windsurf,copilot,antigravity";
  const env = { SPECTRA_CODEX_COMMAND: "git" };
  const adopted = spectra(root, ["adopt", ".", "--agents", agents], env);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  const files = ["AGENTS.md", "CLAUDE.md", ".cursor/rules/spectra-core.mdc", ".windsurf/rules/spectra-core.md", ".github/copilot-instructions.md", ".agent/rules/spectra-core.md"];
  const before = files.map(file => fs.readFileSync(path.join(root, file), "utf8"));
  for (const [i, file] of files.entries()) {
    const content = before[i];
    assert.match(content, /\.spectra\/docs\/acme\/<plugin-or-skill-name>\//);
    assert.match(content, /subsequent reads, links, and references/);
    assert.match(content, /explicit user.*higher-priority/i);
    assert.match(content, /fixed path.*supported configuration/i);
    assert.match(content, /Do not move or delete existing files/);
    assert.match(content, /path separators.*\.\./);
    assert.match(content, /application source code.*required configuration/i);
    assert.doesNotMatch(content, /superpowers/i);
    assert.ok(fs.existsSync(path.join(root, file)));
  }
  const regenerated = localSpectra(root, ["adapters", "--agents", agents], env);
  assert.equal(regenerated.status, 0, regenerated.stderr || regenerated.stdout);
  assert.deepEqual(files.map(file => fs.readFileSync(path.join(root, file), "utf8")), before);
  const pluginFile = path.join(root, ".spectra/docs/acme/example-plugin/plans/task.md");
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(pluginFile, "# Plugin plan\n");
  const guideFile = path.join(root, ".spectra/docs/spectra/workflow.md");
  const guide = fs.readFileSync(guideFile, "utf8");
  fs.writeFileSync(guideFile, "obsolete shipped guide\n");
  const refreshed = spectra(root, ["doctor", "--fix", "--cwd", root], env);
  assert.equal(refreshed.status, 0, refreshed.stderr || refreshed.stdout);
  assert.equal(fs.readFileSync(pluginFile, "utf8"), "# Plugin plan\n");
  assert.equal(fs.readFileSync(guideFile, "utf8"), guide);
  const renamed = path.join(initial, "renamed-project");
  fs.renameSync(root, renamed);
  const afterRename = localSpectra(renamed, ["adapters", "--agents", "claude"], env);
  assert.equal(afterRename.status, 0, afterRename.stderr || afterRename.stdout);
  assert.match(fs.readFileSync(path.join(renamed, "CLAUDE.md"), "utf8"), /\.spectra\/docs\/acme\//);
  fs.renameSync(renamed, root);
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "# User instructions\n");
  const refused = spectra(root, ["adapters", "--agents", "claude"]);
  assert.notEqual(refused.status, 0);
  assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), "# User instructions\n");
  const artifact = path.join(root, ".spectra/cache/plugin-output-guidance-e2e.json");
  fs.writeFileSync(artifact, JSON.stringify(Object.fromEntries(files.map((file, i) => [file, before[i]])), null, 2));
  t.diagnostic(`Repeatable adapter artifact: ${artifact}`);
});

test("project documentation names use existing briefs and avoid guide collisions", t => {
  for (const [name, expected] of [["Acme Billing", "acme-billing"], ["Spectra", "spectra-project"]]) {
    const root = createGitProject();
    const brief = path.join(root, ".spectra/sdd/memory-bank/core/projectbrief.md");
    fs.mkdirSync(path.dirname(brief), { recursive: true });
    fs.writeFileSync(brief, `# Project Brief\n\n## Project Name\n${name}\n`);
    const result = spectra(root, ["init", ".", "--agents", "claude"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra/install.json"), "utf8"));
    assert.equal(metadata.docsProjectName, expected);
    assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), new RegExp(`docs/${expected}/`));
    assert.ok(fs.existsSync(path.join(root, ".spectra/docs/spectra/workflow.md")));
    t.diagnostic(`Name selection artifact: ${root}/.spectra/install.json`);
  }
});

// Failure cases: upgrading an old install deletes legacy documents or plugin
// artifacts; doctor changes the persisted name or rewrites business memory.
test("legacy documentation survives explicit doctor repair", t => {
  const root = createGitProject();
  const installed = spectra(root, ["init", "."]);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  const metadataPath = path.join(root, ".spectra/install.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  delete metadata.docsProjectName;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  const retained = [
    [".spectra/docs/workflow.md", "# Legacy guide\n"],
    [".spectra/docs/example-plugin/plans/old.md", "# Legacy plugin plan\n"],
    [".spectra/sdd/memory-bank/business/README.md", "# Custom business memory\n"]
  ];
  for (const [file, content] of retained) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  const refreshed = spectra(root, ["doctor", "--fix", "--cwd", root]);
  assert.equal(refreshed.status, 0, refreshed.stderr || refreshed.stdout);
  const stableName = JSON.parse(fs.readFileSync(metadataPath, "utf8")).docsProjectName;
  const pluginFile = `.spectra/docs/${stableName}/example-plugin/plans/new.md`;
  fs.mkdirSync(path.dirname(path.join(root, pluginFile)), { recursive: true });
  fs.writeFileSync(path.join(root, pluginFile), "# New plugin plan\n");
  retained.push([pluginFile, "# New plugin plan\n"]);
  const guidePath = path.join(root, ".spectra/docs/spectra/workflow.md");
  const guide = fs.readFileSync(guidePath, "utf8");
  fs.rmSync(guidePath);
  const repaired = spectra(root, ["doctor", "--fix", "--cwd", root]);
  assert.equal(repaired.status, 0, repaired.stderr || repaired.stdout);
  assert.equal(fs.readFileSync(guidePath, "utf8"), guide);
  assert.equal(JSON.parse(fs.readFileSync(metadataPath, "utf8")).docsProjectName, stableName);
  for (const [file, content] of retained) assert.equal(fs.readFileSync(path.join(root, file), "utf8"), content);
  const artifact = path.join(root, ".spectra/cache/document-preservation-e2e.json");
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  fs.writeFileSync(artifact, JSON.stringify({ docsProjectName: stableName, retained: Object.fromEntries(retained), restoredGuide: guide }, null, 2));
  t.diagnostic(`Document preservation artifact: ${artifact}`);
});

// Failure cases: legacy artifacts collide with new guide paths and are
// overwritten on either the first or a repeated refresh; missing siblings
// cause doctor to overwrite a user-owned adapter; external targets inherit
// the source project's persisted documentation name.
test("refresh preserves unowned files colliding with shipped guide paths", t => {
  const root = createGitProject();
  const guidePath = path.join(root, ".spectra/docs/spectra/workflow.md");
  fs.mkdirSync(path.dirname(guidePath), { recursive: true });
  fs.writeFileSync(guidePath, "# Existing plugin workflow\n");
  const installed = spectra(root, ["init", "."]);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  for (const invoke of [spectra, localSpectra]) {
    const result = invoke(root, ["doctor", "--fix", "--cwd", root]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout + result.stderr, /Preserving existing documentation/);
    assert.equal(fs.readFileSync(guidePath, "utf8"), "# Existing plugin workflow\n");
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra/install.json"), "utf8"));
  assert.ok(!metadata.docsGuidePaths.includes("workflow.md"));
  t.diagnostic(`Preserved collision artifact: ${guidePath}`);
});

test("external adapter targets use their own stable documentation name", t => {
  const source = createGitProject();
  const target = createGitProject();
  for (const [root, name] of [[source, "Source Project"], [target, "Target Project"]]) {
    const brief = path.join(root, ".spectra/sdd/memory-bank/core/projectbrief.md");
    fs.mkdirSync(path.dirname(brief), { recursive: true });
    fs.writeFileSync(brief, `# Project Brief\n\n## Project Name\n${name}\n`);
    const installed = spectra(root, ["init", "."]);
    assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  }
  const result = localSpectra(source, ["adapters", "--agents", "claude", "--target", target]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(path.join(target, "CLAUDE.md"), "utf8"), /docs\/target-project\//);
  const bareTarget = createGitProject();
  const repo = fileURLToPath(new URL("../../../", import.meta.url));
  const direct = spawnSync("bash", [path.join(repo, "scripts/generate-adapters.sh"), "--agents", "claude", "--target", bareTarget], { cwd: repo, encoding: "utf8" });
  assert.equal(direct.status, 0, direct.stderr || direct.stdout);
  const expected = path.basename(bareTarget).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  assert.match(fs.readFileSync(path.join(bareTarget, "CLAUDE.md"), "utf8"), new RegExp(`docs/${expected}/`));
  t.diagnostic(`Target adapter artifacts: ${target}/CLAUDE.md and ${bareTarget}/CLAUDE.md`);
});

test("doctor never overwrites a user-owned adapter when its siblings are missing", t => {
  const root = createGitProject();
  const installed = spectra(root, ["init", "."]);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  const core = path.join(root, ".cursor/rules/spectra-core.mdc");
  fs.mkdirSync(path.dirname(core), { recursive: true });
  fs.writeFileSync(core, "# User cursor instructions\n");
  const repaired = spectra(root, ["doctor", "--fix", "--cwd", root]);
  assert.equal(fs.readFileSync(core, "utf8"), "# User cursor instructions\n");
  assert.match(repaired.stdout + repaired.stderr, /Skipping adapter repair.*user-owned/);
  assert.equal(repaired.status, 1, "doctor should still report an unhealthy adapter");
  t.diagnostic(`Preserved user adapter artifact: ${core}`);
});
