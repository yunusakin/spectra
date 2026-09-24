import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") },
    ...options
  });
}

test("spectra verify --unknown fails clearly", () => {
  const result = run(["verify", "--unknown"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option: --unknown/);
});

test("spectra verify --profile fails clearly instead of running", () => {
  const result = run(["verify", "--profile"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Option --profile requires a value/);
});

test("spectra verify --profile --help reports the missing value", () => {
  const result = run(["verify", "--profile", "--help"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Option --profile requires a value/);
  assert.doesNotMatch(result.stdout, /Usage: spectra verify/);
});

test("spectra verify --help=false runs without showing help", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-options-"));
  const result = run(["verify", "--help=false", "--cwd", root], { cwd: root });

  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /Usage: spectra verify/);
  assert.match(result.stderr, /Could not find a Spectra runtime/);
});

test("spectra verify --help=garbage fails with accepted values", () => {
  const result = run(["verify", "--help=garbage"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid value for --help: garbage \(accepted: true, false\)/);
});

test("spectra verify --help still prints usage and succeeds", () => {
  const result = run(["verify", "--help"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: spectra verify/);
});

test("--cwd=<value> keeps '=' inside the value and targets that project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-opt-"));
  const project = path.join(root, "a=b");
  fs.mkdirSync(project);
  const git = (...args) => assert.equal(spawnSync("git", args, { cwd: project }).status, 0);
  git("init", "-q");
  git("config", "user.email", "spectra@example.test");
  git("config", "user.name", "Spectra Test");
  fs.writeFileSync(path.join(project, "only-here.txt"), "x");
  git("add", "only-here.txt");
  git("commit", "-qm", "initial");
  assert.equal(run(["init", "."], { cwd: project }).status, 0);

  const result = run(["status", `--cwd=${project}`], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /only-here\.txt/);
});

test("--yes=false is accepted as a boolean value", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-opt-yes-"));
  const git = (...args) => assert.equal(spawnSync("git", args, { cwd: project }).status, 0);
  git("init", "-q");
  git("config", "user.email", "spectra@example.test");
  git("config", "user.name", "Spectra Test");
  fs.writeFileSync(path.join(project, "f.txt"), "x");
  git("add", "f.txt");
  git("commit", "-qm", "initial");
  assert.equal(run(["init", "."], { cwd: project }).status, 0);

  const result = run(["update", "--yes=false"], { cwd: project });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Unknown option|requires a value|accepted values/);
});
