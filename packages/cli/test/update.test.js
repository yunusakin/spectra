import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveInstalledNativeCommand } from "../src/lib/update.js";

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
      SPECTRA_LATEST_VERSION: "3.0.1",
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

test("migrate --yes migrates a legacy layout", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");

  const result = run(root, ["migrate", "--yes"], { input: "" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Migration complete/);
  assert.match(result.stdout, /Validation and policy checks passed/);
  // Completion is reported only after post-migrate validation succeeds.
  assert.ok(
    result.stdout.indexOf("Validation and policy checks passed") < result.stdout.indexOf("Migration complete"),
    "validation must be reported before completion"
  );
  assert.equal(fs.existsSync(path.join(root, ".spectra", "install.json")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
});

test("migrate migrates a 3.0.8 spectra/ layout and its scripts still resolve SPECTRA_REPO_ROOT afterward", () => {
  // Installed-CLI scripts (validate-repo.sh, check-policy.sh, ...) read
  // $SPECTRA_REPO_ROOT directly rather than relying on cwd alone, so this
  // exercises runInstalledScript()'s data-root resolution end to end for
  // the pre-3.0.9 spectra/ layout, not just root-sdd.
  const root = createGitProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  fs.renameSync(path.join(root, ".spectra"), path.join(root, "spectra"));
  fs.writeFileSync(
    path.join(root, "spectra", "install.json"),
    JSON.stringify({ profile: "lite", gitMode: "local", installMode: "adopt", schemaVersion: 2 })
  );

  fs.writeFileSync(path.join(root, "spectra", "config.yaml"), "gitMode: local\nschemaVersion: 2\n");
  const result = run(root, ["migrate", "--yes"], { input: "" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validation and policy checks passed/);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "system", "manifest.env")), true);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.schemaVersion, 3);
  assert.equal(Object.hasOwn(metadata, "profile"), false);
});

test("migrate surfaces the same incomplete-migration error as init for a broken canonical layout", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra", "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "system", "manifest.env"), "spectra_version=3.0.9\nrepo_mode=consumer\n");

  const result = run(root, ["migrate", "--yes"], { input: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Incomplete migration detected/);
});

test("migrate --yes runs non-interactively without a confirmation prompt", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");

  // No stdin input: a hanging or failing prompt would make this test fail.
  const result = run(root, ["migrate", "--yes"], { input: "" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Migration complete/);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "install.json")), true);
  assert.equal(fs.existsSync(path.join(root, "sdd", "system", "manifest.env")), false);
});

test("migrate --help documents the non-interactive flag", () => {
  const root = createGitProject();
  const result = run(root, ["migrate", "--help"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: spectra migrate.*--yes/);
});

test("migrate refreshes an installed project when only the schema is outdated", () => {
  const root = createGitProject();
  assert.equal(run(root, ["init", "."]).status, 0);
  const metadataPath = path.join(root, ".spectra", "install.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.schemaVersion = 1;
  const configPath = path.join(root, ".spectra", "config.yaml");
  fs.writeFileSync(configPath, fs.readFileSync(configPath, "utf8").replace(/^schemaVersion:.*$/m, "schemaVersion: 1"));
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  fs.rmSync(path.join(root, ".spectra", "sdd", "memory-bank", "business"), { recursive: true, force: true });
  fs.rmSync(path.join(root, ".spectra", "sdd", "memory-bank", "tech"), { recursive: true, force: true });

  const result = run(root, ["migrate", "--yes"], { input: "" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Migration complete/);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "memory-bank", "business", "INDEX.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "memory-bank", "tech", "modules.md")), true);
  const migrated = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  assert.equal(migrated.schemaVersion, 3);
});

test("non-TTY migrate with declined input leaves a legacy layout untouched", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");

  const result = run(root, ["migrate"], { input: "n\n" });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout + result.stderr, /--yes/);
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

test("migrate returns a failure when the post-migration project check fails", () => {
  const root = createGitProject();
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");
  fs.writeFileSync(path.join(root, "company-source.js"), "export const changed = true;\n");

  const result = run(root, ["migrate", "--yes"], { input: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Policy checks failed/);
  // A validation failure must not claim completion.
  assert.match(result.stdout + result.stderr, /Migration applied, but post-migrate validation failed/);
  assert.doesNotMatch(result.stdout, /Migration complete/);
});

test("migrate distinguishes a migration failure from a validation failure", () => {
  const root = createGitProject();
  // Legacy root-sdd project (root sdd/ + .spectra/ data dir, no canonical
  // manifest) whose migration target already exists: the authoritative
  // conflict preflight must abort before any move.
  fs.mkdirSync(path.join(root, ".spectra", "sdd", "system"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ gitMode: "local", installMode: "adopt" }));
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "system", "unrelated.txt"), "target side content\n");
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");

  const result = run(root, ["migrate", "--yes"], { input: "" });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Migration failed during layout migration: Migration conflict/);
  assert.doesNotMatch(result.stdout, /Migration complete/);
  assert.doesNotMatch(result.stdout, /post-migrate validation failed/);
  // Conflict preflight leaves both sides untouched.
  assert.equal(fs.existsSync(path.join(root, "sdd", "system", "manifest.env")), true);
  assert.equal(
    fs.readFileSync(path.join(root, ".spectra", "sdd", "system", "unrelated.txt"), "utf8"),
    "target side content\n"
  );
});
