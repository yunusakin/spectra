import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parseOptions } from "../src/lib/options.js";

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

const CONFIG = {
  booleanFlags: ["--help", "--yes"],
  stringFlags: ["--cwd", "--profile"]
};

test("unknown flags fail instead of becoming positional arguments", () => {
  assert.throws(() => parseOptions(["--unknown"], CONFIG), /Unknown option: --unknown/);
  assert.throws(() => parseOptions(["value", "--unknown", "x"], CONFIG), /Unknown option: --unknown/);

  const result = parseOptions(["positional", "--cwd", "."], CONFIG);
  assert.deepEqual(result.positional, ["positional"]);
  assert.equal(result.options["--cwd"], ".");
});

test("string flags without a value fail with a clear message", () => {
  assert.throws(() => parseOptions(["--profile"], CONFIG), /Option --profile requires a value/);
  assert.throws(() => parseOptions(["--cwd", "--profile", "full"], CONFIG), /Option --cwd requires a value/);
  assert.throws(() => parseOptions(["--profile="], CONFIG), /Option --profile requires a value/);
});

test("string flags do not consume another flag as their value", () => {
  assert.throws(() => parseOptions(["--profile", "--help"], CONFIG), /Option --profile requires a value/);

  const result = parseOptions(["--profile", "full", "--help"], CONFIG);
  assert.equal(result.options["--profile"], "full");
  assert.equal(result.options["--help"], true);
});

test("inline string values may contain equals signs", () => {
  const result = parseOptions(["--cwd=a=b"], CONFIG);
  assert.equal(result.options["--cwd"], "a=b");
});

test("boolean flags only accept true and false inline values", () => {
  assert.equal(parseOptions(["--yes"], CONFIG).options["--yes"], true);
  assert.equal(parseOptions(["--yes=true"], CONFIG).options["--yes"], true);
  assert.equal(parseOptions(["--yes=false"], CONFIG).options["--yes"], false);
  assert.throws(
    () => parseOptions(["--help=garbage"], CONFIG),
    /Invalid value for --help: garbage \(accepted: true, false\)/
  );
  assert.throws(() => parseOptions(["--yes=1"], CONFIG), /Invalid value for --yes: 1/);
});

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
