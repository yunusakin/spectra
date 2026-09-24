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

test("help identifies Lite without advertising advanced commands", () => {
  const root = createProject("lite");
  const result = spawnSync(process.execPath, [cliPath, "help"], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile: lite/);
  assert.doesNotMatch(result.stdout, /spectra approve/);
  assert.doesNotMatch(result.stdout, /spectra admin/);
});
