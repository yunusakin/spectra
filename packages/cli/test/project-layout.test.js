import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getProjectLayout } from "../src/lib/project-layout.js";
import { findSpectraRoot } from "../src/lib/runtime.js";

test("canonical project layout keeps all Spectra-owned files under spectra", () => {
  const layout = getProjectLayout("/tmp/example");

  assert.equal(layout.root, "/tmp/example/spectra");
  assert.equal(layout.sdd, "/tmp/example/spectra/sdd");
  assert.equal(layout.docs, "/tmp/example/spectra/docs");
  assert.equal(layout.installMetadata, "/tmp/example/spectra/install.json");
  assert.equal(layout.launcher, "/tmp/example/spectra/bin/spectra");
});

test("canonical discovery returns the project root from inside spectra", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-project-root-"));
  const layout = getProjectLayout(projectRoot);
  fs.mkdirSync(path.join(layout.sdd, "system"), { recursive: true });
  fs.mkdirSync(layout.docs, { recursive: true });
  fs.writeFileSync(path.join(layout.sdd, "system", "manifest.env"), "repo_mode=consumer\n");
  fs.writeFileSync(layout.installMetadata, "{}\n");

  assert.equal(findSpectraRoot(layout.docs), projectRoot);
});
