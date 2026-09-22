import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { migrateLegacyLayout, needsMigration } from "../src/lib/migration.js";

// Pre-3.0 layout: root-level sdd/ (plus root docs/) with a .spectra/
// data directory holding install.json.
function createLegacyProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-legacy-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".spectra", "install.json"),
    JSON.stringify({ gitMode: "local", installMode: "adopt", localLauncher: "spectra/bin/spectra" })
  );
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");
  fs.writeFileSync(path.join(root, "docs", "workflow.md"), "# Spectra workflow\n");
  fs.writeFileSync(path.join(root, "docs", "company.md"), "# Company documentation\n");
  return root;
}

function excludePath(root) {
  const result = spawnSync("git", ["-C", root, "rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" });
  return path.resolve(root, result.stdout.trim());
}

test("legacy migration moves Spectra-owned state into .spectra and preserves company docs", () => {
  const root = createLegacyProject();
  assert.equal(needsMigration(root), true);
  const result = migrateLegacyLayout(root);

  assert.equal(result.migrated, true);
  assert.equal(fs.existsSync(path.join(root, ".spectra")), true);
  assert.equal(fs.existsSync(path.join(root, "sdd")), false);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "docs", "workflow.md")), true);
  assert.equal(fs.existsSync(path.join(root, "docs", "company.md")), true);

  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.profile, "full");
  assert.equal(metadata.schemaVersion, 2);
  assert.equal(metadata.localLauncher, ".spectra/bin/spectra");
  assert.ok(metadata.excludePatterns.includes("/.spectra/"));
  assert.ok(!metadata.excludePatterns.includes("/spectra/"));

  assert.match(fs.readFileSync(excludePath(root), "utf8"), /^\/\.spectra\/$/m);
  assert.equal(needsMigration(root), false);
});

test("legacy migration is a no-op for canonical projects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-canonical-"));
  fs.mkdirSync(path.join(root, ".spectra", "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), "{}\n");
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "system", "manifest.env"), "repo_mode=consumer\n");

  assert.equal(needsMigration(root), false);
  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "canonical" });
});

test("migration preflights nested conflicts before moving any legacy path", () => {
  const root = createLegacyProject();
  fs.mkdirSync(path.join(root, ".spectra", "sdd"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "owned.md"), "existing target\n");

  assert.throws(() => migrateLegacyLayout(root), /Migration conflict/);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "install.json")), true);
  assert.equal(fs.existsSync(path.join(root, "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
});

test("local migration replaces legacy Spectra exclusions and preserves company entries", () => {
  const root = createLegacyProject();
  fs.writeFileSync(excludePath(root), "/spectra/\n/.spectra/\n/sdd/\n/docs/\n/company-secret/\n");
  const metadataPath = path.join(root, ".spectra", "install.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.excludePatterns = ["/spectra/", "/.spectra/", "/sdd/", "/docs/", "/company-secret/"];
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));

  migrateLegacyLayout(root);

  const exclusions = fs.readFileSync(excludePath(root), "utf8");
  assert.equal(exclusions, "/.spectra/\n/company-secret/\n");
  const migrated = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.deepEqual(migrated.excludePatterns, ["/.spectra/", "/company-secret/"]);
});

test("shared migration leaves repository-local exclusions unchanged", () => {
  const root = createLegacyProject();
  const metadataPath = path.join(root, ".spectra", "install.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.gitMode = "shared";
  metadata.excludePatterns = [];
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  fs.writeFileSync(excludePath(root), "/company-secret/\n");

  migrateLegacyLayout(root);

  assert.equal(fs.readFileSync(excludePath(root), "utf8"), "/company-secret/\n");
  const migrated = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.deepEqual(migrated.excludePatterns, []);
});

test("legacy migration adds business context scaffolding without replacing existing memory", () => {
  const root = createLegacyProject();
  fs.mkdirSync(path.join(root, "sdd", "memory-bank", "core"), { recursive: true });
  fs.writeFileSync(path.join(root, "sdd", "memory-bank", "core", "project.md"), "Existing project memory\n");

  migrateLegacyLayout(root);

  assert.equal(fs.readFileSync(path.join(root, ".spectra", "sdd", "memory-bank", "core", "project.md"), "utf8"), "Existing project memory\n");
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "memory-bank", "tech", "modules.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "memory-bank", "business", "INDEX.md")), true);

  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.schemaVersion, 2);
});

// 3.0.8 installs live entirely under spectra/; migration must move each
// child into .spectra/, merge cache/ (target wins), and remove spectra/.
function createSpectraDirProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-dir-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  fs.mkdirSync(path.join(root, "spectra", "sdd", "system"), { recursive: true });
  fs.mkdirSync(path.join(root, "spectra", "cache", "context"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "spectra", "install.json"),
    JSON.stringify({ gitMode: "local", installMode: "init", profile: "lite", localLauncher: "spectra/bin/spectra" })
  );
  fs.writeFileSync(path.join(root, "spectra", "sdd", "system", "manifest.env"), "spectra_version=3.0.8\nrepo_mode=consumer\n");
  fs.writeFileSync(path.join(root, "spectra", "config.yaml"), "profile: lite\ngitMode: local\nschemaVersion: 2\n");
  fs.writeFileSync(path.join(root, "spectra", "cache", "context", "project.summary.json"), "{\"stale\":true}\n");
  fs.writeFileSync(path.join(root, "spectra", "cache", "context", "only-in-legacy.json"), "{\"legacy\":true}\n");
  return root;
}

test("spectra-dir migration moves the 3.0.8 layout into .spectra and merges cache", () => {
  const root = createSpectraDirProject();
  // Pre-existing canonical cache entry wins over the legacy copy.
  fs.mkdirSync(path.join(root, ".spectra", "cache", "context"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "cache", "context", "project.summary.json"), "{\"fresh\":true}\n");

  assert.equal(needsMigration(root), true);
  const result = migrateLegacyLayout(root);

  assert.equal(result.migrated, true);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "config.yaml")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "docs")), false); // no docs in this fixture

  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.profile, "lite");
  assert.equal(metadata.localLauncher, ".spectra/bin/spectra");
  assert.ok(metadata.excludePatterns.includes("/.spectra/"));

  assert.equal(
    fs.readFileSync(path.join(root, ".spectra", "cache", "context", "project.summary.json"), "utf8"),
    "{\"fresh\":true}\n"
  );
  assert.equal(
    fs.readFileSync(path.join(root, ".spectra", "cache", "context", "only-in-legacy.json"), "utf8"),
    "{\"legacy\":true}\n"
  );

  assert.equal(needsMigration(root), false);
  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "canonical" });
});

test("spectra-dir migration preflights authoritative child conflicts", () => {
  const root = createSpectraDirProject();
  fs.mkdirSync(path.join(root, ".spectra", "sdd"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "owned.md"), "existing target\n");

  assert.throws(() => migrateLegacyLayout(root), /Migration conflict/);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "owned.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "install.json")), false);
});

test("repeated migration is idempotent", () => {
  const root = createLegacyProject();
  assert.equal(migrateLegacyLayout(root).migrated, true);
  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "canonical" });
  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "canonical" });
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "system", "manifest.env")), true);
});

test("migration refuses to move a Spectra source repository", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-source-repo-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.mkdirSync(path.join(root, ".spectra", "cache"), { recursive: true });
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=3.0.9\nrepo_mode=canonical\n");
  fs.writeFileSync(path.join(root, ".spectra", "cache", "state.json"), "{}\n");

  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "source-repo" });
  assert.equal(fs.existsSync(path.join(root, "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd")), false);
});
