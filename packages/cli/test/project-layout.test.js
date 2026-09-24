import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { detectLayout, getCacheRoot, getProjectLayout, getSddRoot } from "../src/lib/project-layout.js";
import { findSpectraRoot } from "../src/lib/runtime.js";

function makeRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeManifest(root, relativeManifestPath) {
  const manifestPath = path.join(root, relativeManifestPath);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, "spectra_version=3.0.9\nrepo_mode=consumer\n");
}

test("layout detection is manifest-based across all supported layouts", () => {
  const canonical = makeRoot("spectra-layout-canonical-");
  writeManifest(canonical, ".spectra/sdd/system/manifest.env");
  assert.equal(detectLayout(canonical), "canonical");
  assert.equal(getSddRoot(canonical), path.join(canonical, ".spectra", "sdd"));
  assert.equal(getCacheRoot(canonical), path.join(canonical, ".spectra", "cache"));

  const spectraDir = makeRoot("spectra-layout-spectra-dir-");
  writeManifest(spectraDir, "spectra/sdd/system/manifest.env");
  assert.equal(detectLayout(spectraDir), "spectra-dir");
  assert.equal(getSddRoot(spectraDir), path.join(spectraDir, "spectra", "sdd"));
  assert.equal(getCacheRoot(spectraDir), path.join(spectraDir, "spectra", "cache"));

  const rootSdd = makeRoot("spectra-layout-root-sdd-");
  writeManifest(rootSdd, "sdd/system/manifest.env");
  assert.equal(detectLayout(rootSdd), "root-sdd");
  assert.equal(getSddRoot(rootSdd), path.join(rootSdd, "sdd"));
  // Pre-3.0 projects keep derived cache in the .spectra data directory.
  assert.equal(getCacheRoot(rootSdd), path.join(rootSdd, ".spectra", "cache"));

  const notInstalled = makeRoot("spectra-layout-none-");
  assert.equal(detectLayout(notInstalled), null);
  assert.equal(getSddRoot(notInstalled), path.join(notInstalled, ".spectra", "sdd"));
  assert.equal(getCacheRoot(notInstalled), path.join(notInstalled, ".spectra", "cache"));
});

test("a .spectra data directory alone does not count as a canonical install", () => {
  // Pre-3.0 projects already had .spectra/install.json — detection must
  // require the canonical manifest, not the metadata file.
  const root = makeRoot("spectra-layout-data-dir-only-");
  fs.mkdirSync(path.join(root, ".spectra"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spectra", "install.json"), "{}\n");
  assert.equal(detectLayout(root), null);
});

test("canonical discovery returns the project root from inside .spectra", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-project-root-"));
  const layout = getProjectLayout(projectRoot);
  fs.mkdirSync(path.join(layout.sdd, "system"), { recursive: true });
  fs.mkdirSync(layout.docs, { recursive: true });
  fs.writeFileSync(path.join(layout.sdd, "system", "manifest.env"), "repo_mode=consumer\n");
  fs.writeFileSync(layout.installMetadata, "{}\n");

  assert.equal(findSpectraRoot(layout.docs), projectRoot);
  assert.equal(findSpectraRoot(layout.root), projectRoot);
});

test("discovery returns the project root from a 3.0.8 spectra data directory", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-legacy-root-"));
  const legacyDataRoot = path.join(projectRoot, "spectra");
  fs.mkdirSync(path.join(legacyDataRoot, "sdd", "system"), { recursive: true });
  fs.mkdirSync(path.join(legacyDataRoot, "docs"), { recursive: true });
  fs.writeFileSync(path.join(legacyDataRoot, "sdd", "system", "manifest.env"), "repo_mode=consumer\n");
  fs.writeFileSync(path.join(legacyDataRoot, "install.json"), "{}\n");

  assert.equal(detectLayout(projectRoot), "spectra-dir");
  assert.equal(findSpectraRoot(path.join(legacyDataRoot, "docs")), projectRoot);
  assert.equal(findSpectraRoot(legacyDataRoot), projectRoot);
  assert.equal(findSpectraRoot(projectRoot), projectRoot);
});

test("discovery finds pre-3.0 root-sdd projects", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-root-sdd-"));
  fs.mkdirSync(path.join(projectRoot, "sdd", "system"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "sdd", "system", "manifest.env"), "repo_mode=consumer\n");

  assert.equal(detectLayout(projectRoot), "root-sdd");
  assert.equal(findSpectraRoot(path.join(projectRoot, "sdd", "system")), projectRoot);
});
