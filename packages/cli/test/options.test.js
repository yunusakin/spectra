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
