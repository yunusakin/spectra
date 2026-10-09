// `status --json` is part of the read-only agent contract. Failure modes this file exists to catch (written before the fix):
//  - the approval state changed since the last write (spec edited after approval) and status --json rewrites
//    governance/approval-state.yaml and memory-bank/core/intake-state.md
//  - the JSON report stops showing the invalidation because the write was removed instead of the persistence
//  - human `status` (documented to recompute approval state) stops persisting it
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cwd, args) => spawnSync(process.execPath, [path.join(cliRoot, "bin", "spectra.js"), ...args], { cwd, encoding: "utf8", env: { ...process.env, SPECTRA_ASSETS_DIR: path.join(cliRoot, "assets") } });
const git = (root, ...args) => assert.equal(spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root }).status, 0, args.join(" "));
const governance = (root) => ["governance/approval-state.yaml", "memory-bank/core/intake-state.md"].map((file) => fs.readFileSync(path.join(root, ".spectra", "sdd", file), "utf8"));

// An approved project whose feature spec was edited afterwards: the stored approval state is out of date.
function invalidatedProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-status-")));
  git(root, "init", "-q");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "x", private: true }));
  assert.equal(run(root, ["init", ".", "--git-mode", "shared"]).status, 0);
  fs.writeFileSync(path.join(root, ".spectra", "sdd", "memory-bank", "core", "projectbrief.md"), "# Project Brief\n\n## Problem\nUsers need a flow.\n\n## Outcome\nGoverned delivery.\n\n## Scope\nCore.\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "brief");
  assert.equal(run(root, ["approve", "--stage", "product-approved"]).status, 0);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "approved");
  const spec = path.join(root, ".spectra", "sdd", "features", "spectra-core", "feature.spec.yaml");
  fs.writeFileSync(spec, fs.readFileSync(spec, "utf8").replace(/^ {2}problem:.*$/m, "  problem: A different problem statement"));
  return root;
}

test("status --json reports the invalidation without writing governance state", () => {
  const root = invalidatedProject();
  const before = governance(root);
  const result = run(root, ["status", "--json"]);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout).approval.invalidations.map((entry) => entry.stage), ["product-approved"]);
  assert.deepEqual(governance(root), before);
});

test("human status still recomputes and persists the approval state", () => {
  const root = invalidatedProject();
  const before = governance(root);
  assert.equal(run(root, ["status"]).status, 0);
  assert.notDeepEqual(governance(root), before);
});
