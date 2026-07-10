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
  assert.match(result.stdout, /spectra init/);
  assert.match(result.stdout, /spectra check/);
  assert.match(result.stdout, /spectra status/);
  assert.match(result.stdout, /spectra help <command>/);
});

test("advanced help lists available advanced commands", () => {
  const result = spawnSync(process.execPath, [cliPath, "help", "advanced"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /spectra admin approve/);
  assert.match(result.stdout, /spectra admin eval/);
  assert.match(result.stdout, /spectra admin diff/);
  assert.match(result.stdout, /spectra admin doctor/);
});

test("admin routes advanced help to existing commands", () => {
  for (const command of ["approve", "eval", "diff", "adapters", "doctor"]) {
    const result = spawnSync(process.execPath, [cliPath, "admin", command, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0, `${command}: ${result.stderr || result.stdout}`);
  }
});

test("help identifies Lite without advertising advanced commands", () => {
  const root = createProject("lite");
  const result = spawnSync(process.execPath, [cliPath, "help"], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile: lite/);
  assert.doesNotMatch(result.stdout, /spectra admin approve/);
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
