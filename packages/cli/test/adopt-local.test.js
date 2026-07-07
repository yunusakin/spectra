import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..");
const workspaceRoot = path.resolve(cliRoot, "..", "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(cwd, command, args = [], options = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets"),
      ...options.env
    }
  });
}

function runOk(cwd, command, args = [], options = {}) {
  const result = run(cwd, command, args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-adopt-local-"));
  runOk(root, "git", ["init", "-q"]);
  runOk(root, "git", ["config", "user.email", "spectra@example.test"]);
  runOk(root, "git", ["config", "user.name", "Spectra Test"]);
  fs.writeFileSync(path.join(root, ".gitignore"), "company-secret.txt\n");
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.writeFileSync(path.join(root, "app", "project.js"), "export const companyCode = true;\n");
  runOk(root, "git", ["add", ".gitignore"]);
  runOk(root, "git", ["commit", "-qm", "initial"]);
  return root;
}

test("adopt local keeps Spectra files local while project code remains visible", () => {
  const root = createRepo();
  const beforeGitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  const result = run(root, process.execPath, [cliPath, "adopt", ".", "--git-mode", "local"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Git mode: local/);
  assert.equal(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), beforeGitignore);

  const status = runOk(root, "git", ["status", "--short", "--untracked-files=all"]).stdout.trim();
  assert.equal(status, "?? app/project.js");

  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.gitMode, "local");
  assert.ok(metadata.ownedPaths.includes("docs/workflow.md"));
  assert.ok(metadata.excludePatterns.includes("/.spectra/"));
  assert.ok(metadata.excludePatterns.includes("/app/README.md"));
});

test("adopt local rejects a non-git target without writing installation files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-adopt-no-git-"));
  const result = run(workspaceRoot, process.execPath, [cliPath, "adopt", root, "--git-mode=local"]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /requires a Git worktree/);
  assert.deepEqual(fs.readdirSync(root), []);
});

test("adopt shared retains the existing gitignore merge behavior", () => {
  const root = createRepo();
  const result = run(root, process.execPath, [cliPath, "adopt", ".", "--git-mode", "shared"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(gitignore, /company-secret\.txt/);
  assert.match(gitignore, /node_modules\//);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.gitMode, "shared");
});

test("repeated local adoption preserves the existing ownership policy", () => {
  const root = createRepo();
  runOk(root, process.execPath, [cliPath, "adopt", ".", "--git-mode", "local"]);
  const before = fs.readFileSync(path.join(root, ".git", "info", "exclude"), "utf8");

  runOk(root, process.execPath, [cliPath, "adopt", ".", "--git-mode", "local"]);

  assert.equal(fs.readFileSync(path.join(root, ".git", "info", "exclude"), "utf8"), before);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.ok(metadata.ownedPaths.includes("docs/workflow.md"));
  assert.ok(metadata.excludePatterns.includes("/sdd/"));
});

test("adapters extend a persistent local policy", () => {
  const root = createRepo();
  runOk(root, process.execPath, [cliPath, "adopt", ".", "--git-mode", "local"]);

  const result = run(root, process.execPath, [
    cliPath,
    "adapters",
    "--agents",
    "codex,copilot",
    "--cwd",
    root
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const status = runOk(root, "git", ["status", "--short", "--untracked-files=all"]).stdout.trim();
  assert.equal(status, "?? app/project.js");
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.ok(metadata.ownedPaths.includes("AGENTS.md"));
  assert.ok(metadata.ownedPaths.includes(".github/copilot-instructions.md"));
  assert.ok(metadata.excludePatterns.includes("/AGENTS.md"));
  assert.ok(metadata.excludePatterns.includes("/.github/copilot-instructions.md"));
  assert.ok(metadata.excludePatterns.includes("/sdd/"));
});

test("local adopt refuses a tracked adapter collision before installing", () => {
  const root = createRepo();
  fs.writeFileSync(path.join(root, "AGENTS.md"), "company instructions\n");
  runOk(root, "git", ["add", "AGENTS.md"]);
  runOk(root, "git", ["commit", "-qm", "company agent instructions"]);

  const result = run(root, process.execPath, [
    cliPath,
    "adopt",
    ".",
    "--git-mode",
    "local",
    "--agents",
    "codex"
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /tracked adapter path.*AGENTS\.md/s);
  assert.equal(fs.existsSync(path.join(root, ".spectra")), false);
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), "company instructions\n");
});
