import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createGitProject, git, initProject, spectra } from "./helpers/project.js";

function approve(root, stage) {
  return spectra(root, ["approve", "--stage", stage]);
}

function approvalState(root) {
  // The contract is YAML when scaffolded and JSON once Spectra rewrites it.
  const text = fs.readFileSync(path.join(root, ".spectra", "sdd", "governance", "approval-state.yaml"), "utf8");
  const field = (name) => text.match(new RegExp(`"?${name}"?:\\s*"?([\\w-]+)`))?.[1];
  return { current_state: field("current_state"), highest_valid_state: field("highest_valid_state") };
}

// Resolves the template placeholders that check-policy.sh rejects.
function resolveTemplateMarkers(root) {
  for (const name of ["activeContext.md", "progress.md"]) {
    const file = path.join(root, ".spectra", "sdd", "memory-bank", "core", name);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/<(?!!--)[^>\n]+>/g, "value").replaceAll("YYYY-MM-DD", "2026-01-01"));
  }
}

function fillProjectBrief(root) {
  resolveTemplateMarkers(root);
  fs.writeFileSync(
    path.join(root, ".spectra", "sdd", "memory-bank", "core", "projectbrief.md"),
    "# Project Brief\n\n## Project Name\nCompany Project\n\n## Goal\nShip a real thing.\n"
  );
}

function commitAll(root, message) {
  git(root, "add", "-A", "-f");
  git(root, "commit", "-qm", message, "--allow-empty");
}

// Ticks every release checklist item, records the work in progress.md (policy
// requires it whenever sdd/ changes) and commits.
function completeReleaseChecklists(root) {
  fs.appendFileSync(path.join(root, ".spectra", "sdd", "memory-bank", "core", "progress.md"), "\n- Release checklist completed.\n");
  checkReleaseChecklists(root);
  commitAll(root, "complete release checklists");
}

function checkReleaseChecklists(root) {
  const featuresDir = path.join(root, ".spectra", "sdd", "features");
  for (const feature of fs.readdirSync(featuresDir)) {
    const checklist = path.join(featuresDir, feature, "release-checklist.md");
    if (fs.existsSync(checklist)) {
      fs.writeFileSync(checklist, fs.readFileSync(checklist, "utf8").replace(/- \[ \]/g, "- [x]"));
    }
  }
}

// Commits the tree so each approval baseline is a real commit, then walks the
// legitimate sequence up to (and including) `upTo`.
function approveThrough(root, upTo) {
  const order = ["product-approved", "technical-approved", "implementation-approved", "release-approved"];
  fillProjectBrief(root);
  for (const stage of order) {
    commitAll(root, `pre ${stage}`);
    if (stage === "release-approved") {
      completeReleaseChecklists(root);
    }
    const result = approve(root, stage);
    assert.equal(result.status, 0, `${stage}: ${result.stderr || result.stdout}`);
    commitAll(root, `record ${stage}`);
    if (stage === upTo) {
      return;
    }
  }
}

test("approval starts at draft and cannot skip stages from draft", () => {
  const root = initProject();
  fillProjectBrief(root);
  assert.equal(approvalState(root).highest_valid_state, "draft");

  for (const stage of ["technical-approved", "implementation-approved", "release-approved"]) {
    const result = approve(root, stage);
    assert.notEqual(result.status, 0, `draft -> ${stage} must be rejected`);
    assert.match(result.stderr + result.stdout, /Cannot skip stages/);
  }
  assert.equal(approvalState(root).current_state, "draft");
});

test("approval cannot skip intermediate stages beyond draft", () => {
  const root = initProject();
  approveThrough(root, "product-approved");
  assert.notEqual(approve(root, "implementation-approved").status, 0);
  assert.notEqual(approve(root, "release-approved").status, 0);
  approveThrough(root, "technical-approved");
  assert.notEqual(approve(root, "release-approved").status, 0);
});

test("stages progress sequentially through release approval", () => {
  const root = initProject();
  approveThrough(root, "release-approved");
  assert.equal(approvalState(root).current_state, "release-approved");
  assert.equal(spectra(root, ["verify"]).status, 0);
});

test("release verify passes at implementation-approved once prerequisites hold (no approval deadlock)", () => {
  const root = initProject();
  approveThrough(root, "implementation-approved");
  completeReleaseChecklists(root);
  const verify = spectra(root, ["verify"]);
  assert.equal(verify.status, 0, verify.stdout + verify.stderr);
});

test("release approval is refused while the release checklist is incomplete", () => {
  const root = initProject();
  approveThrough(root, "implementation-approved");
  const result = approve(root, "release-approved");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Cannot approve release stage/);
});

test("verify and release approval require present, non-empty release checklists", () => {
  const root = initProject();
  approveThrough(root, "implementation-approved");
  completeReleaseChecklists(root);

  const featureDir = path.join(root, ".spectra", "sdd", "features", fs.readdirSync(path.join(root, ".spectra", "sdd", "features"))[0]);
  const checklist = path.join(featureDir, "release-checklist.md");
  const progress = path.join(root, ".spectra", "sdd", "memory-bank", "core", "progress.md");

  fs.appendFileSync(progress, "\n- Release checklist integrity checked.\n");
  fs.writeFileSync(checklist, "# Release Checklist\n");
  commitAll(root, "empty release checklist");
  const emptyVerify = spectra(root, ["verify"]);
  assert.notEqual(emptyVerify.status, 0);
  assert.match(emptyVerify.stdout + emptyVerify.stderr, /no checklist items/i);
  assert.notEqual(approve(root, "release-approved").status, 0);

  fs.appendFileSync(progress, "\n- Missing release checklist check recorded.\n");
  fs.unlinkSync(checklist);
  commitAll(root, "remove release checklist");
  const missingVerify = spectra(root, ["verify"]);
  assert.notEqual(missingVerify.status, 0);
  assert.match(missingVerify.stdout + missingVerify.stderr, /release checklist is missing/i);
  assert.notEqual(approve(root, "release-approved").status, 0);
});

test("release approval enforces verify-work.sh the same way as verify", () => {
  const root = initProject();
  approveThrough(root, "implementation-approved");
  completeReleaseChecklists(root);
  // A template marker fails check-policy.sh (part of verify-work.sh) but is
  // invisible to the JS-side spec validation, so only the shell check can catch it.
  const progress = path.join(root, ".spectra", "sdd", "memory-bank", "core", "progress.md");
  fs.appendFileSync(progress, "\n- Owner: `<unresolved-owner>`\n");
  const verify = spectra(root, ["verify"]);
  const approval = approve(root, "release-approved");
  assert.notEqual(verify.status, 0, "verify must fail when verify-work.sh fails");
  assert.notEqual(approval.status, 0, "release approval must not bypass verify-work.sh");
});

test("re-approving the current stage is allowed", () => {
  const root = initProject();
  approveThrough(root, "product-approved");
  commitAll(root, "again");
  assert.equal(approve(root, "product-approved").status, 0);
});

test("editing projectbrief.md invalidates product approval and re-approval restores it", () => {
  const root = initProject();
  approveThrough(root, "technical-approved");
  assert.equal(approvalState(root).highest_valid_state, "technical-approved");

  fs.appendFileSync(
    path.join(root, ".spectra", "sdd", "memory-bank", "core", "projectbrief.md"),
    "\n## New scope\nAdditional capability.\n"
  );
  commitAll(root, "scope increase");
  spectra(root, ["status"]);
  const status = spectra(root, ["status"]);
  assert.equal(approvalState(root).highest_valid_state, "draft", "scope increase must invalidate approvals");
  assert.match(status.stdout, /Next recommended action:\s+spectra approve --stage product-approved/);

  // Re-approval walks the stages again, sequentially.
  assert.notEqual(approve(root, "technical-approved").status, 0);
  assert.equal(approve(root, "product-approved").status, 0);
  commitAll(root, "re-approved product");
  assert.equal(approve(root, "technical-approved").status, 0);
});

test("editing a feature spec (yaml) invalidates approvals in a canonical project", () => {
  const root = initProject();
  approveThrough(root, "technical-approved");
  const featuresDir = path.join(root, ".spectra", "sdd", "features");
  const feature = fs.readdirSync(featuresDir)[0];
  fs.appendFileSync(path.join(featuresDir, feature, "feature.spec.yaml"), "\n# scope change\n");
  commitAll(root, "spec change");
  spectra(root, ["status"]);
  assert.equal(approvalState(root).highest_valid_state, "draft");
});

test("product approval is refused while projectbrief.md is template-only", () => {
  const root = initProject();
  const result = approve(root, "product-approved");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /template-only/);
  assert.equal(approvalState(root).current_state, "draft");
});

test("dirty project scope cannot receive an approval that immediately invalidates", () => {
  const root = initProject(createGitProject(), ["--git-mode", "shared"]);
  fillProjectBrief(root);

  const refused = approve(root, "product-approved");
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr + refused.stdout, /commit.*retry/i);
  assert.equal(approvalState(root).current_state, "draft");

  commitAll(root, "record product scope");
  const approved = approve(root, "product-approved");
  assert.equal(approved.status, 0, approved.stderr + approved.stdout);
  const status = spectra(root, ["status"]);
  assert.match(status.stdout, /Highest Valid: product-approved/);
  assert.equal(approve(root, "technical-approved").status, 0);
});

test("release approval is refused when the release eval suite is below threshold", () => {
  const root = initProject();
  approveThrough(root, "implementation-approved");
  const featuresDir = path.join(root, ".spectra", "sdd", "features");
  for (const file of fs.readdirSync(path.join(featuresDir, fs.readdirSync(featuresDir)[0], "evals"))) {
    const target = path.join(featuresDir, fs.readdirSync(featuresDir)[0], "evals", file);
    const text = fs.readFileSync(target, "utf8");
    if (/overall_pass_rate/.test(text)) {
      fs.writeFileSync(target, text.replace(/overall_pass_rate:\s*[\d.]+/, "overall_pass_rate: 1.5"));
    }
  }
  completeReleaseChecklists(root);
  assert.notEqual(spectra(root, ["verify"]).status, 0);
  assert.notEqual(approve(root, "release-approved").status, 0);
});
