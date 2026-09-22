import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(testDir, "..", "bin", "spectra.js");
const cliRoot = path.resolve(testDir, "..");

function createProject(profile) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `spectra-help-${profile}-`));
  spawnSync("git", ["-C", root, "init", "-q"]);
  const init = spawnSync(process.execPath, [cliPath, "init", ".", "--profile", profile], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") }
  });
  assert.equal(init.status, 0, init.stderr || init.stdout);
  return root;
}

test("help presents the simplified Spectra workflow", () => {
  const result = spawnSync(process.execPath, [cliPath, "help"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Spectra — AI-assisted development context/);
  assert.match(result.stdout, /spectra init/);
  assert.match(result.stdout, /spectra check/);
  assert.match(result.stdout, /spectra verify/);
  assert.match(result.stdout, /spectra status/);
  assert.match(result.stdout, /spectra help <command>/);
});

test("help groups commands by workflow instead of listing them flat", () => {
  const result = spawnSync(process.execPath, [cliPath, "help"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Getting started:/);
  assert.match(result.stdout, /Context and knowledge:/);
  assert.match(result.stdout, /Quality:/);
  assert.match(result.stdout, /Maintenance:/);
  // Compatibility aliases are not part of the taught vocabulary.
  assert.doesNotMatch(result.stdout, /context-pack/);
  assert.doesNotMatch(result.stdout, /discuss-task/);
  assert.doesNotMatch(result.stdout, /spectra admin/);
});

test("advanced help lists canonical top-level advanced commands", () => {
  const result = spawnSync(process.execPath, [cliPath, "help", "advanced"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /spectra approve/);
  assert.match(result.stdout, /spectra eval/);
  assert.match(result.stdout, /spectra diff/);
  assert.match(result.stdout, /spectra skills/);
  assert.match(result.stdout, /spectra adapters/);
  assert.match(result.stdout, /spectra quick/);
  // The admin grouping is documented once as an alias, not taught per command.
  assert.doesNotMatch(result.stdout, /spectra admin approve/);
  assert.match(result.stdout, /admin <command>.*alias/);
});

test("help resolves canonical descriptions for core and advanced commands", () => {
  const core = spawnSync(process.execPath, [cliPath, "help", "approve"], { encoding: "utf8" });
  assert.equal(core.status, 0, core.stderr);
  assert.match(core.stdout, /spectra approve/);
  assert.match(core.stdout, /Run `spectra approve --help`/);

  const context = spawnSync(process.execPath, [cliPath, "help", "context"], { encoding: "utf8" });
  assert.equal(context.status, 0, context.stderr);
  assert.match(context.stdout, /spectra context/);
  assert.match(context.stdout, /Run `spectra context --help`/);
});

test("check and validate help use their invoked command names", () => {
  const check = spawnSync(process.execPath, [cliPath, "check", "--help"], { encoding: "utf8" });
  const validate = spawnSync(process.execPath, [cliPath, "validate", "--help"], { encoding: "utf8" });

  assert.equal(check.status, 0, check.stderr);
  assert.equal(validate.status, 0, validate.stderr);
  assert.match(check.stdout, /Usage: spectra check/);
  assert.match(validate.stdout, /Usage: spectra validate/);
});

test("help exposes documented verify command details", () => {
  const result = spawnSync(process.execPath, [cliPath, "help", "verify"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /spectra verify/);
  assert.match(result.stdout, /Run `spectra verify --help`/);
});

test("admin routes advanced help to existing commands", () => {
  for (const command of ["approve", "eval", "diff", "adapters", "doctor"]) {
    const result = spawnSync(process.execPath, [cliPath, "admin", command, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0, `${command}: ${result.stderr || result.stdout}`);
  }
});

test("admin remains a compatibility alias for canonical top-level commands", () => {
  const admin = spawnSync(process.execPath, [cliPath, "admin", "quick", "--help"], { encoding: "utf8" });
  const canonical = spawnSync(process.execPath, [cliPath, "quick", "--help"], { encoding: "utf8" });

  assert.equal(admin.status, 0, admin.stderr || admin.stdout);
  assert.equal(canonical.status, 0, canonical.stderr || canonical.stdout);
  assert.equal(admin.stdout, canonical.stdout);
});

test("help identifies Lite without advertising advanced commands", () => {
  const root = createProject("lite");
  const result = spawnSync(process.execPath, [cliPath, "help"], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile: lite/);
  assert.doesNotMatch(result.stdout, /spectra approve/);
  assert.doesNotMatch(result.stdout, /spectra admin/);
});

test("help identifies Full and points to advanced commands", () => {
  const root = createProject("full");
  const result = spawnSync(process.execPath, [cliPath, "help"], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile: full/);
  assert.match(result.stdout, /Full profile: run `spectra help advanced`/);
});

test("help outside a Spectra project remains profile-neutral", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-help-neutral-"));
  const result = spawnSync(process.execPath, [cliPath, "help"], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Profile:/);
});
