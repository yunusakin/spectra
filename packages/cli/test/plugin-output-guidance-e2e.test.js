import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
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
  const refreshed = spectra(root, ["__update-project", "--cwd", root]);
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
test("legacy documentation survives update and doctor repair", t => {
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
  const refreshed = spectra(root, ["__update-project", "--cwd", root]);
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
