import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const helperDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(helperDir, "..", "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(cwd, command, args, env = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets"), ...env }
  });
}

// Installed-CLI invocation.
function spectra(cwd, args, env) {
  return run(cwd, process.execPath, [cliPath, ...args], env);
}

// Repo-local launcher invocation (./.spectra/bin/spectra).
function localSpectra(cwd, args, env) {
  return run(cwd, path.join(cwd, ".spectra", "bin", "spectra"), args, env);
}

function git(cwd, ...args) {
  const result = run(cwd, "git", args);
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

function createGitProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-test-")));
  git(root, "init", "-q");
  git(root, "config", "user.email", "spectra@example.test");
  git(root, "config", "user.name", "Spectra Test");
  fs.writeFileSync(path.join(root, "package.json"), "{\"name\":\"company-project\"}\n");
  git(root, "add", "package.json");
  git(root, "commit", "-qm", "initial");
  return root;
}

function initProject(profile = "full", root = createGitProject(), extraArgs = []) {
  const result = spectra(root, ["init", ".", "--profile", profile, ...extraArgs]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return root;
}

export { cliPath, cliRoot, createGitProject, git, initProject, localSpectra, run, spectra };
