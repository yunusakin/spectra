import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { normalizeCommand } from "../src/main.js";

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

function createProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-grammar-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  const init = run(["init", ".", "--profile", "lite"], { cwd: root });
  assert.equal(init.status, 0, init.stderr || init.stdout);
  return root;
}

test("canonical public commands route directly to their implementation", () => {
  assert.deepEqual(normalizeCommand("context", "--help"), {
    command: "context",
    subcommand: "--help",
    rest: []
  });
  assert.deepEqual(normalizeCommand("task", "--item", "T1"), {
    command: "task",
    subcommand: "--item",
    rest: ["T1"]
  });
  assert.deepEqual(normalizeCommand("eval", "FEAT-001"), {
    command: "eval",
    subcommand: "FEAT-001",
    rest: []
  });
  assert.deepEqual(normalizeCommand("skills", "--task-type", "feature"), {
    command: "skills",
    subcommand: "--task-type",
    rest: ["feature"]
  });
  assert.deepEqual(normalizeCommand("adapters", "--agents", "codex"), {
    command: "adapters",
    subcommand: "--agents",
    rest: ["codex"]
  });
  assert.deepEqual(normalizeCommand("diff", "semantic"), {
    command: "diff",
    subcommand: "semantic",
    rest: []
  });
  assert.deepEqual(normalizeCommand("knowledge", "add", "--domain", "core"), {
    command: "knowledge",
    subcommand: "add",
    rest: ["--domain", "core"]
  });
});

test("legacy command forms normalize to canonical commands", () => {
  // renamed vocabulary
  assert.equal(normalizeCommand("context-pack", "--help").command, "context");
  assert.equal(normalizeCommand("discuss-task", "--item", "T1").command, "task");

  // flattened subcommand depth
  assert.deepEqual(normalizeCommand("eval", "run", "FEAT-001"), {
    command: "eval",
    subcommand: "FEAT-001",
    rest: []
  });
  assert.deepEqual(normalizeCommand("skills", "resolve", "--task-type", "feature"), {
    command: "skills",
    subcommand: "--task-type",
    rest: ["feature"]
  });
  assert.deepEqual(normalizeCommand("adapters", "generate", "--agents", "codex"), {
    command: "adapters",
    subcommand: "--agents",
    rest: ["codex"]
  });
  assert.deepEqual(normalizeCommand("spec", "diff", "semantic"), {
    command: "diff",
    subcommand: "semantic",
    rest: []
  });

  // admin grouping becomes the canonical top-level command
  assert.deepEqual(normalizeCommand("admin", "approve", "--stage", "release-approved"), {
    command: "approve",
    subcommand: "--stage",
    rest: ["release-approved"]
  });
  assert.deepEqual(normalizeCommand("admin", "quick", "--type", "docs"), {
    command: "quick",
    subcommand: "--type",
    rest: ["docs"]
  });

  // unknown admin subcommands stay unknown instead of silently passing
  assert.equal(normalizeCommand("admin", "bogus").command, "admin");
});

test("legacy forms reach the canonical usage text", () => {
  const cases = [
    [["eval", "run", "--help"], /Usage: spectra eval/],
    [["skills", "resolve", "--help"], /Usage: spectra skills/],
    [["adapters", "generate", "--help"], /Usage: spectra adapters/],
    [["spec", "diff", "--help"], /Usage: spectra diff/],
    [["diff", "--help"], /Usage: spectra diff/],
    [["context-pack", "--help"], /Usage: spectra context/],
    [["discuss-task", "--help"], /Usage: spectra task/],
    [["admin", "quick", "--help"], /Usage: spectra quick/],
    [["admin", "approve", "--help"], /Usage: spectra approve/]
  ];

  for (const [args, pattern] of cases) {
    const result = run(args);
    assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, pattern, args.join(" "));
  }
});

test("every canonical command answers --help at a single command token", () => {
  const canonical = [
    "init", "adopt", "onboard", "context", "task", "route", "knowledge",
    "check", "verify", "status", "update", "upgrade", "doctor",
    "approve", "eval", "diff", "quick", "skills", "adapters", "validate"
  ];

  for (const command of canonical) {
    const result = run([command, "--help"]);
    assert.equal(result.status, 0, `${command}: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, new RegExp(`Usage: spectra ${command}`), command);
  }
});

test("installed CLI and local launcher expose the same grammar", () => {
  const root = createProject();
  const installed = run(["help"], { cwd: root });
  const local = spawnSync(path.join(root, ".spectra", "bin", "spectra"), ["help"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") }
  });

  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert.equal(local.status, 0, local.stderr || local.stdout);
  assert.equal(local.stdout, installed.stdout);

  // The legacy admin alias resolves identically through both interfaces.
  const installedAlias = run(["admin", "skills", "--help"], { cwd: root });
  const localAlias = spawnSync(path.join(root, ".spectra", "bin", "spectra"), ["admin", "skills", "--help"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") }
  });
  assert.equal(installedAlias.status, 0, installedAlias.stderr || installedAlias.stdout);
  assert.equal(localAlias.status, 0, localAlias.stderr || localAlias.stdout);
  assert.equal(localAlias.stdout, installedAlias.stdout);
  assert.match(installedAlias.stdout, /Usage: spectra skills/);
});

test("unknown commands fail clearly", () => {
  const result = run(["definitely-not-a-command"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command: definitely-not-a-command/);
});
