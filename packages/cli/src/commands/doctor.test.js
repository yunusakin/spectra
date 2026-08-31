import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getCliVersion } from "../lib/version.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..", "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");
const expectedVersion = getCliVersion();

function run(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") }
  });
}

function git(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function createProject(profile = "lite", extraArgs = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-doctor-"));
  assert.equal(git(root, ["init", "-q"]).status, 0);
  assert.equal(run(root, ["init", ".", "--profile", profile, ...extraArgs]).status, 0);
  return root;
}

test("doctor remains read-only without fix", () => {
  const root = createProject();
  const launcherPath = path.join(root, "spectra", "bin", "spectra");
  fs.rmSync(launcherPath);

  const result = run(root, ["doctor", "--cwd", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(launcherPath), false);
});

test("doctor --fix restores generated files and version metadata without rewriting business memory", () => {
  const root = createProject();
  const launcherPath = path.join(root, "spectra", "bin", "spectra");
  const runtimePath = path.join(root, "spectra", "sdd", "system", "runtime", "minimal.md");
  const docsPath = path.join(root, "spectra", "docs", "workflow.md");
  const manifestPath = path.join(root, "spectra", "sdd", "system", "manifest.env");
  const metadataPath = path.join(root, "spectra", "install.json");
  const businessPath = path.join(root, "spectra", "sdd", "memory-bank", "business", "README.md");

  fs.rmSync(launcherPath);
  fs.rmSync(runtimePath);
  fs.rmSync(docsPath);
  fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, "utf8").replace(/^spectra_version=.*$/m, "spectra_version=0.0.1"));
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  fs.writeFileSync(metadataPath, JSON.stringify({ ...metadata, cliVersion: "0.0.1", runtimeVersion: "0.0.1" }, null, 2));
  fs.writeFileSync(businessPath, "# Custom Business Notes\n\nKeep this exact user text.\n");

  const result = run(root, ["doctor", "--fix", "--cwd", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Fixed:/);
  assert.equal(fs.existsSync(launcherPath), true);
  assert.equal(fs.existsSync(runtimePath), true);
  assert.equal(fs.existsSync(docsPath), true);
  assert.match(fs.readFileSync(manifestPath, "utf8"), new RegExp(`^spectra_version=${expectedVersion.replaceAll(".", "\\.")}$`, "m"));
  const fixedMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  assert.equal(fixedMetadata.cliVersion, expectedVersion);
  assert.equal(fixedMetadata.runtimeVersion, expectedVersion);
  assert.match(fs.readFileSync(businessPath, "utf8"), /Keep this exact user text/);
});

test("doctor --fix does not recreate missing memory-bank files", () => {
  const root = createProject();
  const businessReadmePath = path.join(root, "spectra", "sdd", "memory-bank", "business", "README.md");
  const activeContextPath = path.join(root, "spectra", "sdd", "memory-bank", "core", "activeContext.md");
  fs.rmSync(businessReadmePath);
  fs.rmSync(activeContextPath);

  const result = run(root, ["doctor", "--fix", "--cwd", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(businessReadmePath), false);
  assert.equal(fs.existsSync(activeContextPath), false);
});

test("doctor --fix does not rewrite Full governance or feature state", () => {
  const root = createProject("full");
  const approvalPath = path.join(root, "spectra", "sdd", "governance", "approval-state.yaml");
  const featuresRoot = path.join(root, "spectra", "sdd", "features");
  const featureDir = fs.readdirSync(featuresRoot)[0];
  const featureSpecPath = path.join(featuresRoot, featureDir, "feature.spec.yaml");
  const customApproval = `${fs.readFileSync(approvalPath, "utf8")}# user approval note\n`;
  const customFeature = `${fs.readFileSync(featureSpecPath, "utf8")}# user feature note\n`;
  fs.writeFileSync(approvalPath, customApproval);
  fs.writeFileSync(featureSpecPath, customFeature);

  const result = run(root, ["doctor", "--fix", "--cwd", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(approvalPath, "utf8"), customApproval);
  assert.equal(fs.readFileSync(featureSpecPath, "utf8"), customFeature);
});

test("doctor --fix restores local git exclude policy", () => {
  const root = createProject();
  const excludePath = git(root, ["rev-parse", "--git-path", "info/exclude"]).stdout.trim();
  fs.writeFileSync(path.resolve(root, excludePath), "");

  const result = run(root, ["doctor", "--fix", "--cwd", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(git(root, ["check-ignore", "spectra/install.json"]).status, 0);
});

test("doctor --fix restores missing detected adapter files", () => {
  const root = createProject("full", ["--git-mode", "shared", "--agents", "cursor"]);
  const adapterPath = path.join(root, ".cursor", "rules", "spectra-context.mdc");
  fs.rmSync(adapterPath);

  const result = run(root, ["doctor", "--fix", "--cwd", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(adapterPath), true);
});

test("doctor --fix reports manual business validation errors without rewriting them", () => {
  const root = createProject();
  const rulesPath = path.join(root, "spectra", "sdd", "memory-bank", "business", "README.md");
  fs.writeFileSync(rulesPath, "# Broken Business Memory\n\nManual repair required.\n");
  const indexPath = path.join(root, "spectra", "sdd", "memory-bank", "business", "INDEX.md");
  fs.writeFileSync(
    indexPath,
    "| Domain | Keywords | Rules | Unresolved | Related Modules |\n| --- | --- | --- | --- | --- |\n| customer-policy | eligibility;approval | business/customer-policy/rules.md | business/customer-policy/unresolved.md | |\n"
  );

  const result = run(root, ["doctor", "--fix", "--cwd", root]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Manual action required:/);
  assert.match(result.stdout, /invalid routing keyword delimiter/);
  assert.match(fs.readFileSync(rulesPath, "utf8"), /Manual repair required/);
});

test("admin doctor --fix routes to doctor fix behavior", () => {
  const root = createProject();
  const launcherPath = path.join(root, "spectra", "bin", "spectra");
  fs.rmSync(launcherPath);

  const result = run(root, ["admin", "doctor", "--fix", "--cwd", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(launcherPath), true);
});
