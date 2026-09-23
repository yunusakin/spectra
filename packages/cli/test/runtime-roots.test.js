import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cliRoot, git, initProject, localSpectra, run, spectra } from "./helpers/project.js";

const invocations = [
  ["installed CLI", spectra],
  ["local launcher", localSpectra]
];

for (const [label, invoke] of invocations) {
  test(`spectra diff init/update works under the canonical .spectra root (${label})`, () => {
    const root = initProject("full");
    const init = invoke(root, ["diff", "init"]);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    assert.doesNotMatch(init.stderr, /missing \.git|not look like a git repository/);

    // Tracked edit to a spec file plus an untracked new one, then update.
    const core = path.join(root, ".spectra", "sdd", "memory-bank", "core");
    fs.appendFileSync(path.join(core, "projectbrief.md"), "\nEdited.\n");
    fs.writeFileSync(path.join(core, "new-note.md"), "note\n");
    git(root, "add", "-A", "-f");
    git(root, "commit", "-qm", "spec change");
    fs.appendFileSync(path.join(core, "progress.md"), "\nexcluded change\n");

    const update = invoke(root, ["diff", "update", "--stdout"]);
    assert.equal(update.status, 0, update.stderr || update.stdout);
    // Paths are data-root-relative (no .spectra/ prefix) so the excludes apply.
    assert.match(update.stdout, /sdd\/memory-bank\/core\/projectbrief\.md/);
    assert.doesNotMatch(update.stdout, /\.spectra\/\.spectra|`\.spectra\/sdd/);
    assert.doesNotMatch(update.stdout, /### (Modified|Added)[\s\S]*core\/progress\.md/, "progress.md must stay excluded");
  });
}

test("spectra diff supports --base, --no-worktree and --patch from a nested directory", () => {
  const root = initProject("full");
  const base = git(root, "rev-parse", "HEAD").trim();
  fs.appendFileSync(path.join(root, ".spectra", "sdd", "memory-bank", "core", "projectbrief.md"), "\nEdited.\n");
  git(root, "add", "-A", "-f");
  git(root, "commit", "-qm", "spec change");
  fs.mkdirSync(path.join(root, "src"));
  const result = spectra(path.join(root, "src"), ["diff", "update", "--base", base, "--no-worktree", "--patch", "--stdout"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /projectbrief\.md/);
  assert.match(result.stdout, /```diff/);
});

test("check-policy sees tracked and untracked changes to the same logical file identically", () => {
  // Shared mode: .spectra is not Git-excluded, so untracked files are visible.
  const root = initProject("full", undefined, ["--git-mode", "shared"]);
  git(root, "add", "-A");
  git(root, "commit", "-qm", "baseline");
  const core = path.join(root, ".spectra", "sdd", "memory-bank", "core");
  const progressComplaint = /Spec\/code files changed in checked range but .*progress\.md was not updated/;

  // Tracked + modified.
  fs.appendFileSync(path.join(core, "invariants.md"), "\n- new invariant\n");
  const tracked = spectra(root, ["check"]);
  assert.match(tracked.stdout + tracked.stderr, progressComplaint, "tracked change must be recognised");
  git(root, "checkout", "--", ".spectra/sdd/memory-bank/core/invariants.md");

  // Untracked (new file under the same sdd/ namespace).
  fs.writeFileSync(path.join(core, "extra.md"), "# Extra\n");
  const untracked = spectra(root, ["check"]);
  assert.match(untracked.stdout + untracked.stderr, progressComplaint, "untracked change must be recognised");
  fs.rmSync(path.join(core, "extra.md"));

  // Committed range (base..head).
  fs.appendFileSync(path.join(core, "invariants.md"), "\n- new invariant\n");
  git(root, "commit", "-qam", "invariant change");
  const range = spectra(root, ["check", "--base", "HEAD~1", "--head", "HEAD"]);
  assert.match(range.stdout + range.stderr, progressComplaint, "committed range change must be recognised");
});

test("install/update never delete user-owned .DS_Store files outside .spectra", () => {
  const root = initProject("lite");
  fs.mkdirSync(path.join(root, "assets"));
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "assets", ".DS_Store"), "user");
  fs.writeFileSync(path.join(root, "docs", ".DS_Store"), "user");
  fs.writeFileSync(path.join(root, ".DS_Store"), "user");

  for (const args of [["update"], ["doctor", "--fix"]]) {
    const result = spectra(root, args);
    assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr || result.stdout}`);
  }
  // Fresh init into a directory that already has such files.
  const adopted = initProject("lite", (() => {
    const other = fs.mkdtempSync(path.join(root, "..", "spectra-ds-"));
    git(other, "init", "-q");
    git(other, "config", "user.email", "a@b.c");
    git(other, "config", "user.name", "t");
    fs.writeFileSync(path.join(other, "f.txt"), "x");
    git(other, "add", "f.txt");
    git(other, "commit", "-qm", "i");
    fs.mkdirSync(path.join(other, "assets"));
    fs.writeFileSync(path.join(other, "assets", ".DS_Store"), "user");
    return other;
  })());

  for (const base of [root, adopted]) {
    assert.equal(fs.existsSync(path.join(base, "assets", ".DS_Store")), true, `${base}/assets/.DS_Store`);
  }
  assert.equal(fs.existsSync(path.join(root, "docs", ".DS_Store")), true);
  assert.equal(fs.existsSync(path.join(root, ".DS_Store")), true);
});

test("health-check scans the project for tests and resolves install metadata", () => {
  const root = initProject("full");
  fs.mkdirSync(path.join(root, "test"));
  fs.writeFileSync(path.join(root, "test", "app.test.js"), "");
  fs.mkdirSync(path.join(root, "src", "test"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "test", "FooTest.java"), "");
  const dataRoot = path.join(root, ".spectra");
  const script = path.join(cliRoot, "..", "core", "assets", "runtime", "scripts", "health-check.sh");
  // Same environment runInstalledScript() provides.
  const result = run(dataRoot, "bash", [script], {
    SPECTRA_REPO_ROOT: dataRoot,
    SPECTRA_DATA_ROOT: dataRoot,
    SPECTRA_PROJECT_ROOT: root,
    SPECTRA_RUNTIME_ROOT: path.join(cliRoot, "assets", "runtime")
  });
  assert.match(result.stdout, /Tests:\s+2 test file\(s\) found/);
});
