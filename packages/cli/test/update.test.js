import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveInstalledNativeCommand, runSelfUpdate } from "../src/lib/update.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");

function run(cwd, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    input: options.input,
    env: {
      ...process.env,
      SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets"),
      SPECTRA_LATEST_VERSION: "3.0.0",
      ...options.env
    }
  });
}

function createGitProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-update-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  spawnSync("git", ["-C", root, "config", "user.email", "spectra@example.test"]);
  spawnSync("git", ["-C", root, "config", "user.name", "Spectra Test"]);
  fs.writeFileSync(path.join(root, "README.md"), "# Project\n");
  spawnSync("git", ["-C", root, "add", "README.md"]);
  spawnSync("git", ["-C", root, "commit", "-qm", "initial"]);
  return root;
}

test("update reports an already-current CLI and runtime", () => {
  const root = createGitProject();
  assert.equal(run(root, ["init", "."]).status, 0);

  const result = run(root, ["update"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Spectra is already up to date/);
});

test("update confirms and migrates a legacy layout", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");

  const result = run(root, ["update"], { input: "y\n" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Update complete/);
  assert.match(result.stdout, /Validation and policy checks passed/);
  assert.equal(fs.existsSync(path.join(root, "spectra", "install.json")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra")), false);
});

test("declining update leaves a legacy layout untouched", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");

  const result = run(root, ["update"], { input: "n\n" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Update cancelled/);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "install.json")), true);
  assert.equal(fs.existsSync(path.join(root, "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
});

test("native update resolves the installed command without relying on PATH", () => {
  assert.equal(
    resolveInstalledNativeCommand({ SPECTRA_BIN: "/opt/spectra-bin", HOME: "/home/test" }),
    path.join("/opt/spectra-bin", "spectra")
  );
  assert.equal(
    resolveInstalledNativeCommand({ HOME: "/home/test" }),
    path.join("/home/test", ".local", "bin", "spectra")
  );
});

test("newer Node CLI update dispatches the requested package version", () => {
  const calls = [];
  const status = runSelfUpdate("3.1.0", "/projects/orders", {
    execPath: "/usr/local/bin/node",
    spawn(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0 };
    }
  });

  assert.equal(status, 0);
  assert.deepEqual(calls[0].command, "npx");
  assert.deepEqual(calls[0].args, ["-y", "spectra-pack@3.1.0", "__update-project", "--cwd", "/projects/orders"]);
});

test("update returns a failure when the post-migration project check fails", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");
  fs.writeFileSync(path.join(root, "company-source.js"), "export const changed = true;\n");

  const result = run(root, ["update"], { input: "y\n" });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Policy checks failed/);
});
