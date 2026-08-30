import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { migrateLegacyLayout } from "../src/lib/migration.js";

function createLegacyProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-legacy-"));
  spawnSync("git", ["-C", root, "init", "-q"]);
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(root, "sdd", "system"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".spectra", "install.json"),
    JSON.stringify({ gitMode: "local", installMode: "adopt", localLauncher: ".spectra/bin/spectra" })
  );
  fs.writeFileSync(path.join(root, "sdd", "system", "manifest.env"), "spectra_version=2.0.3\nrepo_mode=consumer\n");
  fs.writeFileSync(path.join(root, "docs", "workflow.md"), "# Spectra workflow\n");
  fs.writeFileSync(path.join(root, "docs", "company.md"), "# Company documentation\n");
  return root;
}

test("legacy migration moves Spectra-owned state into spectra and preserves company docs", () => {
  const root = createLegacyProject();
  const result = migrateLegacyLayout(root);

  assert.equal(result.migrated, true);
  assert.equal(fs.existsSync(path.join(root, ".spectra")), false);
  assert.equal(fs.existsSync(path.join(root, "sdd")), false);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "system", "manifest.env")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "docs", "workflow.md")), true);
  assert.equal(fs.existsSync(path.join(root, "docs", "company.md")), true);

  const metadata = JSON.parse(fs.readFileSync(path.join(root, "spectra", "install.json"), "utf8"));
  assert.equal(metadata.profile, "full");
  assert.equal(metadata.schemaVersion, 2);
  assert.equal(metadata.localLauncher, "spectra/bin/spectra");
  assert.ok(metadata.excludePatterns.includes("/spectra/"));

  const excludePath = spawnSync("git", ["-C", root, "rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" }).stdout.trim();
  assert.match(fs.readFileSync(path.resolve(root, excludePath), "utf8"), /^\/spectra\/$/m);
});

test("legacy migration is a no-op for canonical projects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-canonical-"));
  fs.mkdirSync(path.join(root, "spectra", "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(root, "spectra", "install.json"), "{}\n");
  fs.writeFileSync(path.join(root, "spectra", "sdd", "system", "manifest.env"), "repo_mode=consumer\n");

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
  const excludePath = spawnSync("git", ["-C", root, "rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" }).stdout.trim();
  fs.writeFileSync(path.resolve(root, excludePath), "/.spectra/\n/sdd/\n/docs/\n/company-secret/\n");
  const metadataPath = path.join(root, ".spectra", "install.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.excludePatterns = ["/.spectra/", "/sdd/", "/docs/", "/company-secret/"];
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));

  migrateLegacyLayout(root);

  const exclusions = fs.readFileSync(path.resolve(root, excludePath), "utf8");
  assert.equal(exclusions, "/company-secret/\n/spectra/\n");
  const migrated = JSON.parse(fs.readFileSync(path.join(root, "spectra", "install.json"), "utf8"));
  assert.deepEqual(migrated.excludePatterns, ["/company-secret/", "/spectra/"]);
});

test("shared migration leaves repository-local exclusions unchanged", () => {
  const root = createLegacyProject();
  const metadataPath = path.join(root, ".spectra", "install.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.gitMode = "shared";
  metadata.excludePatterns = [];
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  const excludePath = spawnSync("git", ["-C", root, "rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" }).stdout.trim();
  fs.writeFileSync(path.resolve(root, excludePath), "/company-secret/\n");

  migrateLegacyLayout(root);

  assert.equal(fs.readFileSync(path.resolve(root, excludePath), "utf8"), "/company-secret/\n");
});

test("legacy migration adds business context scaffolding without replacing existing memory", () => {
  const root = createLegacyProject();
  fs.mkdirSync(path.join(root, "sdd", "memory-bank", "core"), { recursive: true });
  fs.writeFileSync(path.join(root, "sdd", "memory-bank", "core", "project.md"), "Existing project memory\n");

  migrateLegacyLayout(root);

  assert.equal(fs.readFileSync(path.join(root, "spectra", "sdd", "memory-bank", "core", "project.md"), "utf8"), "Existing project memory\n");
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "memory-bank", "tech", "modules.md")), true);
  assert.equal(fs.existsSync(path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md")), true);

  const metadata = JSON.parse(fs.readFileSync(path.join(root, "spectra", "install.json"), "utf8"));
  assert.equal(metadata.schemaVersion, 2);
});
