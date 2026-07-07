import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  beginLocalGitPolicy,
  finishLocalGitPolicy,
  resolveGitMode
} from "../src/lib/git-policy.js";

function run(cwd, command, args = []) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-git-policy-"));
  run(root, "git", ["init", "-q"]);
  run(root, "git", ["config", "user.email", "spectra@example.test"]);
  run(root, "git", ["config", "user.name", "Spectra Test"]);
  fs.writeFileSync(path.join(root, "existing.txt"), "existing\n");
  run(root, "git", ["add", "existing.txt"]);
  run(root, "git", ["commit", "-qm", "initial"]);
  return root;
}

test("resolveGitMode honors an explicit mode and rejects invalid values", async () => {
  assert.equal(await resolveGitMode({ requestedMode: "local", isTTY: false }), "local");
  assert.equal(await resolveGitMode({ requestedMode: "shared", isTTY: true }), "shared");
  await assert.rejects(
    resolveGitMode({ requestedMode: "hidden", isTTY: false }),
    /--git-mode must be local or shared/
  );
});

test("resolveGitMode defaults non-interactive calls to shared and interactive calls to local", async () => {
  assert.equal(await resolveGitMode({ isTTY: false }), "shared");
  assert.equal(
    await resolveGitMode({
      isTTY: true,
      ask: async ({ defaultMode }) => defaultMode
    }),
    "local"
  );
});

test("local policy refuses non-git targets before creating files", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-not-git-"));
  assert.throws(() => beginLocalGitPolicy(target), /requires a Git worktree/);
  assert.deepEqual(fs.readdirSync(target), []);
});

test("local policy records only created files and preserves existing exclude rules", () => {
  const root = createGitRepo();
  const target = path.join(root, "services", "balance api");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "company.md"), "company\n");

  const excludePath = run(root, "git", ["rev-parse", "--git-path", "info/exclude"]);
  fs.appendFileSync(path.resolve(root, excludePath), "\n/company-local.txt\n");

  const policy = beginLocalGitPolicy(target);
  fs.mkdirSync(path.join(target, ".spectra"), { recursive: true });
  fs.mkdirSync(path.join(target, "sdd", "system"), { recursive: true });
  fs.mkdirSync(path.join(target, "docs"), { recursive: true });
  fs.writeFileSync(path.join(target, ".spectra", "install.json"), "{}\n");
  fs.writeFileSync(path.join(target, "sdd", "system", "manifest.env"), "repo_mode=consumer\n");
  fs.writeFileSync(path.join(target, "docs", "workflow.md"), "workflow\n");

  const result = finishLocalGitPolicy(policy);
  assert.deepEqual(result.ownedPaths, [
    ".spectra/install.json",
    "docs/workflow.md",
    "sdd/system/manifest.env"
  ]);
  assert.deepEqual(result.excludePatterns, [
    "/services/balance api/.spectra/",
    "/services/balance api/docs/workflow.md",
    "/services/balance api/sdd/"
  ]);

  const firstContent = fs.readFileSync(result.excludePath, "utf8");
  assert.match(firstContent, /\/company-local\.txt/);
  assert.match(firstContent, /# >>> spectra local:services\/balance api/);

  finishLocalGitPolicy({ ...policy, beforeFiles: policy.beforeFiles });
  assert.equal(fs.readFileSync(result.excludePath, "utf8"), firstContent);
  assert.equal(run(root, "git", ["status", "--short"]), "?? services/");
  assert.match(
    run(root, "git", ["status", "--short", "--ignored"]),
    /!! [\"]?services\/balance api\/\.spectra\//
  );
});

test("local policy uses exact paths when a Spectra root existed before adoption", () => {
  const root = createGitRepo();
  const target = path.join(root, "consumer");
  fs.mkdirSync(path.join(target, "sdd"), { recursive: true });
  fs.writeFileSync(path.join(target, "sdd", "company.md"), "company\n");

  const policy = beginLocalGitPolicy(target);
  fs.writeFileSync(path.join(target, "sdd", "spectra.md"), "spectra\n");
  const result = finishLocalGitPolicy(policy);

  assert.deepEqual(result.excludePatterns, ["/consumer/sdd/spectra.md"]);
  assert.equal(
    run(root, "git", ["status", "--short", "--untracked-files=all"]),
    "?? consumer/sdd/company.md"
  );
});

test("local policy rejects tracked Spectra roots before mutation", () => {
  const root = createGitRepo();
  fs.mkdirSync(path.join(root, "sdd"), { recursive: true });
  fs.writeFileSync(path.join(root, "sdd", "existing.md"), "tracked\n");
  run(root, "git", ["add", "sdd/existing.md"]);
  run(root, "git", ["commit", "-qm", "track sdd"]);

  assert.throws(() => beginLocalGitPolicy(root), /tracked Spectra path.*sdd\/existing\.md/s);
});

test("local policy writes to the shared Git exclude file from a linked worktree", () => {
  const root = createGitRepo();
  const worktree = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-worktree-parent-")), "linked");
  run(root, "git", ["worktree", "add", "-q", "-b", "local-policy-test", worktree]);

  const policy = beginLocalGitPolicy(worktree);
  fs.mkdirSync(path.join(worktree, ".spectra"), { recursive: true });
  fs.writeFileSync(path.join(worktree, ".spectra", "install.json"), "{}\n");
  const result = finishLocalGitPolicy(policy);

  assert.equal(fs.realpathSync(result.excludePath), fs.realpathSync(path.join(root, ".git", "info", "exclude")));
  assert.equal(run(worktree, "git", ["check-ignore", ".spectra/install.json"]), ".spectra/install.json");
});
