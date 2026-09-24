import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildProjectBriefDraft, resolveOnboardingAnswers } from "../src/lib/onboarding.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "..");
const cliPath = path.join(cliRoot, "bin", "spectra.js");
const fixturesDir = path.join(testDir, "fixtures");

function run(cwd, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets"),
      ...options.env
    }
  });
}

function runOk(cwd, args, options = {}) {
  const result = run(cwd, args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function projectBriefPath(root) {
  return path.join(root, ".spectra", "sdd", "memory-bank", "core", "projectbrief.md");
}

// ---------------------------------------------------------------------------
// Unit: buildProjectBriefDraft (pure render function)
// ---------------------------------------------------------------------------

test("buildProjectBriefDraft appends an evidence-labeled detected-stack section from a repo index", () => {
  const repoIndex = {
    ecosystems: ["node", "go"],
    records: [
      { kind: "module", name: "@acme/api", path: "packages/api", ecosystem: "node", confidence: "high", status: "confirmed" },
      { kind: "module", name: "example.com/svc", path: "svc", ecosystem: "go", confidence: "high", status: "confirmed" }
    ]
  };
  const draft = buildProjectBriefDraft({ answers: { projectName: "Demo" }, repoIndex });
  assert.match(draft, /Detected Stack \(from `spectra index`\)/);
  assert.match(draft, /node/);
  assert.match(draft, /go/);
  assert.match(draft, /@acme\/api/);
  assert.match(draft, /example\.com\/svc/);
  assert.match(draft, /spectra index --explain/);
});

// ---------------------------------------------------------------------------
// Unit: resolveOnboardingAnswers (decision logic, mirrors resolveGitMode)
// ---------------------------------------------------------------------------

test("resolveOnboardingAnswers returns null without prompting when the brief already has real content", async () => {
  let asked = false;
  const result = await resolveOnboardingAnswers({
    isTTY: true,
    ask: async () => {
      asked = true;
      return {};
    },
    existingHasContent: true,
    force: false
  });
  assert.equal(result, null);
  assert.equal(asked, false);
});

test("resolveOnboardingAnswers prompts and returns answers on a fresh, interactive template", async () => {
  const answers = { projectName: "Demo", purpose: "Do the thing" };
  const result = await resolveOnboardingAnswers({
    isTTY: true,
    ask: async () => answers,
    existingHasContent: false,
    force: false
  });
  assert.deepEqual(result, answers);
});

test("resolveOnboardingAnswers prompts even with existing content when --force is set", async () => {
  let asked = false;
  const result = await resolveOnboardingAnswers({
    isTTY: true,
    ask: async () => {
      asked = true;
      return { projectName: "Overwritten" };
    },
    existingHasContent: true,
    force: true
  });
  assert.equal(asked, true);
  assert.deepEqual(result, { projectName: "Overwritten" });
});

// ---------------------------------------------------------------------------
// CLI: spectra onboard
// ---------------------------------------------------------------------------

function createNodeFixtureRepo() {
  const source = path.join(fixturesDir, "node-workspace");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-onboard-"));
  fs.cpSync(source, root, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: root });
  spawnSync("git", ["config", "user.email", "spectra@example.test"], { cwd: root });
  spawnSync("git", ["config", "user.name", "Spectra Test"], { cwd: root });
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "fixture import"], { cwd: root });
  return root;
}

test("spectra onboard before spectra index has run reports guidance and writes nothing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-onboard-noindex-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  spawnSync("git", ["config", "user.email", "spectra@example.test"], { cwd: root });
  spawnSync("git", ["config", "user.name", "Spectra Test"], { cwd: root });
  fs.writeFileSync(path.join(root, "placeholder.txt"), "x\n");
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["commit", "-qm", "initial"], { cwd: root });

  runOk(root, ["init", "."]);
  const before = fs.readFileSync(projectBriefPath(root), "utf8");

  const result = runOk(root, ["onboard"]);
  assert.match(result.stderr, /spectra index/);

  const after = fs.readFileSync(projectBriefPath(root), "utf8");
  assert.equal(before, after);
});

test("spectra onboard runs non-interactively (spawned, non-TTY) and never rewrites the template", () => {
  const root = createNodeFixtureRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const before = fs.readFileSync(projectBriefPath(root), "utf8");
  assert.match(before, /Filled by intake/);

  const result = runOk(root, ["onboard"]);
  assert.match(result.stdout, /node/);

  const after = fs.readFileSync(projectBriefPath(root), "utf8");
  assert.equal(before, after);
});

test("spectra onboard does not overwrite a brief that already has real content, without --force", () => {
  const root = createNodeFixtureRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);
  const briefPath = projectBriefPath(root);
  const handWritten = "# Project Brief\n\n## Project Name\nHand Written\n";
  fs.writeFileSync(briefPath, handWritten);

  const result = runOk(root, ["onboard"]);
  assert.match(result.stdout, /already has real content/);
  assert.equal(fs.readFileSync(briefPath, "utf8"), handWritten);
});

test("adopt prints a next-step hint pointing at spectra onboard", () => {
  const root = createNodeFixtureRepo();
  const result = runOk(root, ["adopt", ".", "--git-mode", "local"]);
  assert.match(result.stdout, /\.spectra\/bin\/spectra onboard/);
});

// ---------------------------------------------------------------------------
// End-to-end wiring: the wizard's output must flow through the existing
// context pipeline (parseProjectSummary), not just look like plausible markdown.
// ---------------------------------------------------------------------------

test("a wizard-written brief is picked up by spectra context's project summary", () => {
  const root = createNodeFixtureRepo();
  runOk(root, ["adopt", ".", "--git-mode", "local"]);

  const draft = buildProjectBriefDraft({
    answers: { projectName: "Orders API", purpose: "Let partners submit bulk orders", appType: "REST service" },
    repoIndex: null
  });
  fs.writeFileSync(projectBriefPath(root), draft);

  runOk(root, ["context", "--role", "planner", "--goal", "discover", "--format", "json"]);

  const summaryPath = path.join(root, ".spectra", "cache", "context", "project.summary.json");
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  assert.equal(summary.projectName, "Orders API");
  assert.equal(summary.purpose, "Let partners submit bulk orders");
});
