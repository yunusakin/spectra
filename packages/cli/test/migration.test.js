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

test("root-sdd migration that fails on Git exclusions leaves sdd/ in place and is retryable", () => {
  const root = createLegacyProject();
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });

  assert.throws(() => migrateLegacyLayout(root), /outside a Git worktree/);
  assert.equal(fs.existsSync(path.join(root, "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd")), false);
  assert.equal(needsMigration(root), true);

  spawnSync("git", ["-C", root, "init", "-q"]);
  const retry = migrateLegacyLayout(root);
  assert.equal(retry.migrated, true);
  assert.equal(fs.existsSync(path.join(root, "sdd")), false);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd", "system", "manifest.env")), true);
  assert.equal(fs.readFileSync(path.join(root, ".spectra", "docs", "workflow.md"), "utf8"), "# Spectra workflow\n");
  assert.equal(fs.readFileSync(path.join(root, "docs", "company.md"), "utf8"), "# Company documentation\n");
  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "canonical" });
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

test("spectra-dir migration that fails on Git exclusions changes nothing and is retryable", () => {
  const root = createSpectraDirProject();
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });

  assert.throws(() => migrateLegacyLayout(root), /outside a Git worktree/);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "install.json")), true);
  assert.equal(fs.existsSync(path.join(root, ".spectra", "sdd")), false);
  assert.equal(needsMigration(root), true);

  spawnSync("git", ["-C", root, "init", "-q"]);
  assert.equal(migrateLegacyLayout(root).migrated, true);
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"));
  assert.equal(metadata.localLauncher, ".spectra/bin/spectra");
  assert.match(fs.readFileSync(excludePath(root), "utf8"), /^\/\.spectra\/$/m);
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

test("a spectra/ directory holding only cache/ beside a complete .spectra install is cleaned up", () => {
  // Simulates migrateSpectraDirLayout()'s final fs.rmSync(legacyRoot)
  // failing after every other step succeeded. Every non-cache child was
  // already MOVED into .spectra/, so only the (copied, regenerable)
  // cache/ remains — a provably harmless leftover the next run finishes.
  const root = createSpectraDirProject();
  assert.equal(migrateLegacyLayout(root).migrated, true);
  fs.mkdirSync(path.join(root, "spectra", "cache", "context"), { recursive: true });
  fs.writeFileSync(path.join(root, "spectra", "cache", "context", "stale.json"), "{}\n");

  assert.equal(needsMigration(root), true);
  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "canonical" });
  assert.equal(fs.existsSync(path.join(root, "spectra")), false);
  assert.equal(needsMigration(root), false);
});

test("a spectra/ directory with non-cache content beside .spectra is a conflict and is left untouched", () => {
  // Two independent, possibly diverged trees (e.g. an old backup restored
  // after .spectra/ was already in use). Nothing about this can be proven
  // redundant, so neither side may be modified, and the error must say
  // which entries conflict instead of claiming they were already migrated.
  const root = createSpectraDirProject();
  assert.equal(migrateLegacyLayout(root).migrated, true);

  fs.mkdirSync(path.join(root, "spectra", "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, "spectra", "sdd", "system", "manifest.env"), "spectra_version=3.0.8\nrepo_mode=consumer\n");
  fs.writeFileSync(path.join(root, "spectra", "sdd", "restored-note.md"), "content only the old tree has\n");
  fs.writeFileSync(path.join(root, "spectra", "install.json"), "{\"from\":\"old-backup\"}\n");
  const canonicalInstallBefore = fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8");

  assert.equal(needsMigration(root), true);
  assert.throws(() => migrateLegacyLayout(root), (error) => {
    assert.match(error.message, /Conflicting legacy layout/);
    assert.match(error.message, /sdd/);
    assert.match(error.message, /install\.json/);
    assert.match(error.message, /Neither tree was modified/);
    return true;
  });

  assert.equal(fs.readFileSync(path.join(root, "spectra", "sdd", "restored-note.md"), "utf8"), "content only the old tree has\n");
  assert.equal(fs.readFileSync(path.join(root, "spectra", "install.json"), "utf8"), "{\"from\":\"old-backup\"}\n");
  assert.equal(fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8"), canonicalInstallBefore);
});

test("needsMigration reports true for a canonical sdd/ manifest without install.json", () => {
  // `spectra update` only attempts migration when needsMigration() is
  // true, so this broken state must be reported as needing migration —
  // otherwise `update` would skip straight past migrateLegacyLayout()'s
  // "Incomplete migration detected" error and fail with a generic,
  // unrelated message instead.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-broken-migration-needs-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  fs.mkdirSync(path.join(root, ".spectra", "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "system", "manifest.env"), "spectra_version=3.0.9\nrepo_mode=consumer\n");

  assert.equal(needsMigration(root), true);
});

test("a canonical sdd/ manifest without install.json is reported as an incomplete migration, not a no-op", () => {
  // Simulates a prior migration that moved sdd/ into place but crashed
  // before writing install.json (e.g. Git exclusions failed).
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-broken-migration-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  fs.mkdirSync(path.join(root, ".spectra", "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "system", "manifest.env"), "spectra_version=3.0.9\nrepo_mode=consumer\n");

  assert.throws(() => migrateLegacyLayout(root), /Incomplete migration detected/);
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

test("source-repo protection is not bypassed by a stray canonical .spectra/sdd manifest", () => {
  // A prior accidental `init` inside the source repo could leave a
  // .spectra/sdd/ manifest behind. detectLayout() would then report
  // "canonical" (it checks .spectra/ before root sdd/), which must not
  // let a later init/adopt/update start treating the source repo as an
  // ordinary consumer install.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-source-repo-stray-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=3.0.9\nrepo_mode=canonical\n");
  fs.mkdirSync(path.join(root, ".spectra", "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "system", "manifest.env"), "spectra_version=3.0.9\nrepo_mode=consumer\n");
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), JSON.stringify({ profile: "lite" }));

  assert.deepEqual(migrateLegacyLayout(root), { migrated: false, reason: "source-repo" });
});
