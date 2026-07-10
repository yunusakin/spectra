import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installSpectra } from "../lib/install.js";
import { upgradeCommand } from "./upgrade.js";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spectra-upgrade-"));
}

test("upgrade promotes Lite to Full without overwriting memory-bank files", async () => {
  const targetDir = tempDir();
  installSpectra({ targetDir, profile: "lite", gitMode: "shared" });
  const brief = path.join(targetDir, "spectra", "sdd", "memory-bank", "core", "projectbrief.md");
  fs.appendFileSync(brief, "\nLocal project context.\n");

  const status = await upgradeCommand(["--cwd", targetDir, "--profile", "full", "--yes"]);

  assert.equal(status, 0);
  assert.match(fs.readFileSync(brief, "utf8"), /Local project context/);
  assert.equal(fs.existsSync(path.join(targetDir, "spectra", "sdd", "governance")), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(targetDir, "spectra", "install.json"), "utf8")).profile, "full");
  assert.match(fs.readFileSync(path.join(targetDir, "spectra", "config.yaml"), "utf8"), /^profile: full$/m);
});
