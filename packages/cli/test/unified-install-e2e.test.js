import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { getCliVersion } from "../src/lib/version.js";

const testDir = path.dirname(new URL(import.meta.url).pathname);
const cliRoot = path.resolve(testDir, "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets"),
      SPECTRA_LATEST_VERSION: getCliVersion()
    }
  });
}

function createGitProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-unified-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "spectra@example.test"],
    ["config", "user.name", "Spectra Test"]
  ]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  fs.writeFileSync(path.join(root, "README.md"), "# Project\n");
  const add = spawnSync("git", ["add", "README.md"], { cwd: root, encoding: "utf8" });
  assert.equal(add.status, 0, add.stderr);
  const commit = spawnSync("git", ["commit", "-qm", "initial"], { cwd: root, encoding: "utf8" });
  assert.equal(commit.status, 0, commit.stderr);
  return root;
}

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

test("init installs Full capabilities by default without recording an installation profile", () => {
  const root = createGitProject();
  const result = run(root, ["init", "."]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "governance", "approval-state.yaml")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "features")), true);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.schemaVersion, 3);
  assert.equal(Object.hasOwn(metadata, "profile"), false);
  const config = fs.readFileSync(path.join(root, ".spectra", "config.yaml"), "utf8");
  assert.doesNotMatch(config, /^profile:/m);
});

test("update silently brings a same-version legacy Lite install to the unified runtime and preserves user files", () => {
  const root = createGitProject();
  const adapterPath = path.join(root, "CLAUDE.md");
  fs.writeFileSync(adapterPath, "# User adapter\nKeep this content.\n");
  const add = spawnSync("git", ["add", "CLAUDE.md"], { cwd: root, encoding: "utf8" });
  assert.equal(add.status, 0, add.stderr);
  const commit = spawnSync("git", ["commit", "-qm", "add adapter"], { cwd: root, encoding: "utf8" });
  assert.equal(commit.status, 0, commit.stderr);

  write(root, ".spectra/install.json", JSON.stringify({
    profile: "lite",
    cliVersion: getCliVersion(),
    runtimeVersion: getCliVersion(),
    schemaVersion: 2,
    gitMode: "shared",
    installMode: "init"
  }));
  write(root, ".spectra/config.yaml", "profile: lite\ngitMode: shared\nschemaVersion: 2\n");
  write(root, ".spectra/sdd/system/manifest.env", "spectra_version=3.1.1\nrepo_mode=consumer\n");
  write(root, ".spectra/sdd/system/runtime/minimal.md", "Legacy Lite runtime\n");
  write(root, ".spectra/sdd/memory-bank/core/projectbrief.md", "# Private project brief\nKeep my requirements.\n");

  const result = run(root, ["update", "--yes"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Update complete/);
  assert.doesNotMatch(result.stdout + result.stderr, /profile/i);
  assert.equal(
    fs.readFileSync(path.join(root, ".spectra/sdd/memory-bank/core/projectbrief.md"), "utf8"),
    "# Private project brief\nKeep my requirements.\n"
  );
  assert.equal(fs.readFileSync(adapterPath, "utf8"), "# User adapter\nKeep this content.\n");
  assert.equal(fs.existsSync(path.join(root, ".spectra/sdd/governance/approval-state.yaml")), true);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra/install.json"), "utf8"));
  assert.equal(metadata.schemaVersion, 3);
  assert.equal(Object.hasOwn(metadata, "profile"), false);
  const config = fs.readFileSync(path.join(root, ".spectra/config.yaml"), "utf8");
  assert.doesNotMatch(config, /^profile:/m);

  const secondUpdate = run(root, ["update", "--yes"]);
  assert.equal(secondUpdate.status, 0, secondUpdate.stderr || secondUpdate.stdout);
  assert.match(secondUpdate.stdout, /already up to date/i);
});

test("installation help and status expose no profile choice or state", () => {
  const root = createGitProject();
  assert.equal(run(root, ["init", "."]).status, 0);

  for (const command of ["init", "adopt"]) {
    const help = run(root, [command, "--help"]);
    assert.equal(help.status, 0, help.stderr || help.stdout);
    assert.doesNotMatch(help.stdout, /--profile|Lite|Full profile/i);
  }

  const help = run(root, ["help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.doesNotMatch(help.stdout, /Profile:|upgrade|Lite|Full profile/i);

  const status = run(root, ["status"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.doesNotMatch(status.stdout, /Profile:/i);

  const oldInstallFlag = run(root, ["init", ".", "--profile", "full"]);
  assert.equal(oldInstallFlag.status, 1);
  assert.match(oldInstallFlag.stderr, /Unknown option: --profile/);

  const oldUpgradeCommand = run(root, ["upgrade"]);
  assert.equal(oldUpgradeCommand.status, 1);
  assert.match(oldUpgradeCommand.stderr, /Unknown command: upgrade/);
});
