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

function run(cwd, command, args) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") }
  });
}

function createGitProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-layout-"));
  assert.equal(run(root, "git", ["init", "-q"]).status, 0);
  assert.equal(run(root, "git", ["config", "user.email", "spectra@example.test"]).status, 0);
  assert.equal(run(root, "git", ["config", "user.name", "Spectra Test"]).status, 0);
  fs.writeFileSync(path.join(root, "package.json"), "{\"name\":\"company-project\"}\n");
  assert.equal(run(root, "git", ["add", "package.json"]).status, 0);
  assert.equal(run(root, "git", ["commit", "-qm", "initial"]).status, 0);
  return root;
}

test("Lite init keeps all generated files under spectra", () => {
  const root = createGitProject();
  const result = run(root, process.execPath, [cliPath, "init", "."]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "runtime", "minimal.md")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "adapters")), false);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "prompts")), false);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "memory-bank", "core", "projectbrief.md")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "docs", "workflow.md")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "bin", "spectra")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "config.yaml")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "install.json")), true);
  assert.equal(fs.existsSync(path.join(root, "sdd")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra")), false);
  assert.equal(fs.existsSync(path.join(root, "docs")), false);
  assert.equal(fs.existsSync(path.join(root, "app")), false);
  assert.equal(fs.existsSync(path.join(root, ".github")), false);

  const metadata = JSON.parse(fs.readFileSync(path.join(root, "spectra", "install.json"), "utf8"));
  assert.equal(metadata.profile, "lite");
  assert.equal(metadata.gitMode, "local");
  assert.equal(metadata.schemaVersion, 2);
  const config = fs.readFileSync(path.join(root, "spectra", "config.yaml"), "utf8");
  assert.match(config, /^profile: lite$/m);
  assert.match(config, /^gitMode: local$/m);
  assert.match(config, /^schemaVersion: 2$/m);
  assert.equal(run(root, "git", ["check-ignore", "spectra/install.json"]).status, 0);
});

test("setup rejects an unsupported profile before writing files", () => {
  const root = createGitProject();
  const result = run(root, process.execPath, [cliPath, "init", ".", "--profile", "unsupported"]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /--profile must be lite or full/);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
});

test("setup rejects profile or Git-mode changes for an existing installation", () => {
  const root = createGitProject();
  const initial = run(root, process.execPath, [cliPath, "init", "."]);
  assert.equal(initial.status, 0, initial.stderr || initial.stdout);

  const profileChange = run(root, process.execPath, [cliPath, "adopt", ".", "--profile", "full"]);
  assert.equal(profileChange.status, 1);
  assert.match(profileChange.stdout, /profile changes require an explicit upgrade/);

  const gitModeChange = run(root, process.execPath, [cliPath, "adopt", ".", "--git-mode", "shared"]);
  assert.equal(gitModeChange.status, 1);
  assert.match(gitModeChange.stdout, /Git mode changes require an explicit migration/);

  const config = fs.readFileSync(path.join(root, "spectra", "config.yaml"), "utf8");
  assert.match(config, /^profile: lite$/m);
  assert.match(config, /^gitMode: local$/m);
});

test("Lite setup rejects root-level agent adapter generation", () => {
  const root = createGitProject();
  const result = run(root, process.execPath, [cliPath, "init", ".", "--agents", "codex"]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Agent adapters require --profile full/);
  assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), false);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
});

test("Full init adds governance and feature scaffolding under spectra", () => {
  const root = createGitProject();
  const result = run(root, process.execPath, [cliPath, "init", ".", "--profile", "full"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "governance", "approval-state.yaml")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "features")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "adapters")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "prompts")), true);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "spectra", "install.json"), "utf8"));
  assert.equal(metadata.profile, "full");
});

test("Full shared init materializes repo-local runtime assets for adapter commands", () => {
  const root = createGitProject();
  const result = run(root, process.execPath, [cliPath, "init", ".", "--profile", "full", "--git-mode", "shared"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(root, "spectra", "cli", "assets", "runtime", "scripts", "generate-adapters.sh")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "cli", "assets", "profiles", "lite", "profile.yaml")), true);
  const adapters = run(root, process.execPath, [
    path.join(root, "spectra", "cli", "bin", "spectra.js"),
    "adapters", "--cwd", root, "--agents", "claude,cursor,windsurf,copilot,antigravity", "--target", root
  ]);
  assert.equal(adapters.status, 0, adapters.stderr || adapters.stdout);
});


test("Full status and check resolve governance from spectra", () => {
  const root = createGitProject();
  const init = run(root, process.execPath, [cliPath, "init", ".", "--profile", "full"]);
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const status = run(root, process.execPath, [cliPath, "status", "--cwd", root]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.match(status.stdout, /Approval State:/);

  const check = run(root, process.execPath, [cliPath, "check", "--cwd", root]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("Full check blocks unapproved company source changes outside spectra", () => {
  const root = createGitProject();
  const init = run(root, process.execPath, [cliPath, "init", ".", "--profile", "full"]);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "orders.js"), "export const orders = [];\n");

  const check = run(root, process.execPath, [cliPath, "check", "--cwd", root]);
  assert.equal(check.status, 1);
  assert.match(check.stdout, /Project code contains changes without implementation approval/);
});

test("Full adopt writes discovery and governance artifacts under spectra", () => {
  const root = createGitProject();
  fs.writeFileSync(path.join(root, "README.md"), "# Company project\n");
  const result = run(root, process.execPath, [cliPath, "adopt", ".", "--profile", "full"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "memory-bank", "discovery", "stack.md")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "adoption", "current-state.summary.yaml")), true);
  assert.equal(fs.existsSync(path.join(root, "sdd")), false);
});

test("Lite status and check do not require Full governance files", () => {
  const root = createGitProject();
  const init = run(root, process.execPath, [cliPath, "init", "."]);
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const status = run(root, process.execPath, [cliPath, "status", "--cwd", root]);
  assert.equal(status.status, 0, status.stderr || status.stdout);

  const check = run(root, process.execPath, [cliPath, "check", "--cwd", root]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Lite project checks passed/);
});

test("status summarizes recent project and Spectra updates", () => {
  const root = createGitProject();
  const init = run(root, process.execPath, [cliPath, "init", "."]);
  assert.equal(init.status, 0, init.stderr || init.stdout);

  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "orders.js"), "export const orders = [];\n");
  fs.writeFileSync(path.join(root, "notes.md"), "# Company note\n");
  fs.appendFileSync(path.join(root, "spectra", "sdd", "memory-bank", "core", "progress.md"), "\nProject work resumed.\n");

  const status = run(root, process.execPath, [cliPath, "status", "--cwd", root]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.match(status.stdout, /Spectra Project Status/);
  assert.match(status.stdout, /Recent updates:/);
  assert.match(status.stdout, /src\/orders\.js/);
  assert.match(status.stdout, /notes\.md/);
  assert.match(status.stdout, /spectra\/sdd\/memory-bank\/core\/progress\.md/);
});

test("status includes source and nested Markdown from the latest commit", () => {
  const root = createGitProject();
  assert.equal(run(root, process.execPath, [cliPath, "init", "."]).status, 0);
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "handbook"));
  fs.writeFileSync(path.join(root, "src", "orders.js"), "export const orders = [];\n");
  fs.writeFileSync(path.join(root, "handbook", "operations.md"), "# Operations\n");
  assert.equal(run(root, "git", ["add", "src/orders.js", "handbook/operations.md"]).status, 0);
  assert.equal(run(root, "git", ["commit", "-qm", "add order docs"]).status, 0);

  const status = run(root, process.execPath, [cliPath, "status", "--cwd", root]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.match(status.stdout, /src\/orders\.js/);
  assert.match(status.stdout, /handbook\/operations\.md/);
});

test("status omits untouched generated memory templates", () => {
  const root = createGitProject();
  assert.equal(run(root, process.execPath, [cliPath, "init", "."]).status, 0);

  const status = run(root, process.execPath, [cliPath, "status", "--cwd", root]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.doesNotMatch(status.stdout, /traceability\.md/);
  assert.doesNotMatch(status.stdout, /sprint-plan\.md/);
  assert.doesNotMatch(status.stdout, /review-gate\.md/);
});

test("Lite context resolves files from spectra/sdd", () => {
  const root = createGitProject();
  const init = run(root, process.execPath, [cliPath, "init", "."]);
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const context = run(root, process.execPath, [cliPath, "context", "--role", "planner", "--goal", "discover"]);
  assert.equal(context.status, 0, context.stderr || context.stdout);
  assert.match(context.stdout, /Spectra Context Pack/);
  assert.match(context.stdout, /sdd\/memory-bank\/core\/projectbrief\.md/);
  assert.doesNotMatch(context.stdout, /sdd\/system\/runtime\/minimal\.md \[full, missing\]/);
  assert.equal(fs.existsSync(path.join(root, ".spectra")), false);
  assert.equal(fs.existsSync(path.join(root, "spectra", "cache", "context", "project.summary.json")), true);
});

test("Lite task writes its implementation brief under spectra/sdd", () => {
  const root = createGitProject();
  const init = run(root, process.execPath, [cliPath, "init", "."]);
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const task = run(root, process.execPath, [
    cliPath,
    "task",
    "--item",
    "FEAT-101",
    "--task-type",
    "feature",
    "--goal",
    "Create the order flow"
  ]);
  assert.equal(task.status, 0, task.stderr || task.stdout);
  const brief = fs.readFileSync(path.join(root, "spectra", "sdd", "memory-bank", "core", "implementation-brief.md"), "utf8");
  assert.match(brief, /FEAT-101/);
  assert.match(brief, /Create the order flow/);
  assert.equal(fs.existsSync(path.join(root, "sdd")), false);
});
