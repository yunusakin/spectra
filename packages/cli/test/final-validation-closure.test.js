// Final validation closure. Failure modes recorded before any product change:
//  P1a  task-text retrieval never selects an architectural invariant (feature candidates omit the kind)
//  P1b  the fix selects every invariant, or only some by special scoring (it must be the same term-overlap rule as FR/NFR/AC)
//  P1c  an unrelated invariant is pulled in, or an invariant becomes mandatory
//  P1d  explicit-ID lookup (inspect, verify --explain, a task naming the ID) changes
//  P2a  `verify --test-target` runs a package-script body without the package's node_modules/.bin on PATH (exit 127)
//  P2b  the fix resolves the wrong directory's .bin (repository root instead of the target's directory)
//  P2c  a missing binary still has to fail, record no evidence and keep its exit status
//  P2d  inherited system commands stop resolving, or the process-global PATH is mutated
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createGitProject, git, spectra } from "./helpers/project.js";

const sdd = root => path.join(root, ".spectra", "sdd");
const write = (file, text, mode) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, mode ? { mode } : undefined); };
const ok = (root, args) => { const r = spectra(root, args); assert.equal(r.status, 0, `${args.join(" ")}: ${r.stdout}${r.stderr}`); return r; };
const labels = (root, task, role = "implementer", goal = "implement") =>
  JSON.parse(ok(root, ["context", "--role", role, "--goal", goal, "--route-task", task, "--format", "json"]).stdout).entries.filter(entry => entry.source === "resolved").map(entry => entry.label);

function featureProject(feature, invariants) {
  const root = createGitProject();
  ok(root, ["init", ".", "--git-mode", "local"]);
  write(path.join(sdd(root), "features", feature, "feature.spec.yaml"), `apiVersion: spectra/v2
kind: FeatureSpec
metadata:
  id: ${feature}
  name: ${feature}
  version: 0.1.0
  owner: product
  status: draft
summary:
  problem: x
  outcome: y
scope:
  in:
    - z
  out:
    - w
requirements:
  functional:
    - id: FR-1
      statement: Quarterly widgets are tallied.
      priority: must
acceptance:
  scenarios:
    - id: AC-1
      covers:
        - FR-1
      given: Quarterly widgets
      when: They are tallied
      then: The tally matches
invariants:
${invariants.map(([id, statement]) => `  - id: ${id}\n    statement: ${statement}`).join("\n")}
`);
  ok(root, ["index"]);
  return root;
}

test("P1: a natural greenfield-style task retrieves the relevant invariant and not an unrelated one", () => {
  const root = featureProject("ledger", [["INV-1", "Ledger history is append-only; recorded entries are never modified or removed."], ["INV-2", "Currency codes follow the three letter ISO format."]]);
  const got = labels(root, "Change the ledger behavior while preserving append-only history");
  assert.ok(got.includes("ledger#INV-1"), `INV-1 missing from ${JSON.stringify(got)}`);
  assert.ok(!got.includes("ledger#INV-2"), "an unrelated invariant must not be selected");
});

test("P1: a natural brownfield-style task retrieves the relevant invariant and not an unrelated one", () => {
  const root = featureProject("plan-enforcement", [["INV-1", "An unmet plan must fail deterministically when the test ends."], ["INV-2", "Reports are encoded as UTF-8 text."]]);
  const got = labels(root, "Modify plan enforcement without breaking the invariant that an unmet plan must fail deterministically");
  assert.ok(got.includes("plan-enforcement#INV-1"), `INV-1 missing from ${JSON.stringify(got)}`);
  assert.ok(!got.includes("plan-enforcement#INV-2"), "an unrelated invariant must not be selected");
});

test("P1: invariants stay optional, are not forced into unrelated tasks, and explicit-ID behavior is unchanged", () => {
  const root = featureProject("ledger", [["INV-1", "Ledger history is append-only; recorded entries are never modified or removed."]]);
  const unrelated = labels(root, "Rename the deployment pipeline stages");
  assert.ok(!unrelated.includes("ledger#INV-1"), "an invariant is not selected without term overlap");
  // optional, never mandatory: the selection records it as a non-required candidate
  const pack = JSON.parse(ok(root, ["context", "--role", "implementer", "--goal", "implement", "--route-task", "Change the ledger behavior while preserving append-only history", "--format", "json"]).stdout);
  const included = pack.selection.included.find(entry => entry.id === "ledger#INV-1");
  assert.ok(included, "selected");
  assert.equal(included.required, false);
  // explicit ID: still required, still resolved
  const explicit = labels(root, "Review ledger#INV-1");
  assert.ok(explicit.includes("ledger#INV-1"));
  const inspected = JSON.parse(ok(root, ["inspect", "ledger#INV-1", "--json"]).stdout);
  assert.equal(inspected.subject.kind, "architectural-invariant");
  assert.equal(JSON.parse(ok(root, ["verify", "--explain", "ledger#INV-1", "--json"]).stdout).id, "ledger#INV-1");
});

// ------------------------------------------------------------------------------------------------ P2
const posix = process.platform !== "win32";
function binProject() {
  const root = createGitProject();
  write(path.join(root, "package.json"), JSON.stringify({ name: "company-project", version: "1.0.0", scripts: { test: "node --version", "test:localbin": "fixture-tool", "test:missing": "no-such-tool-anywhere", "test:system": "node -e \"process.exit(0)\"" } }));
  write(path.join(root, "node_modules/.bin/fixture-tool"), "#!/bin/sh\nexit 0\n", 0o755);
  git(root, "add", "-A"); git(root, "commit", "-qm", "app");
  ok(root, ["init", ".", "--git-mode", "local"]);
  ok(root, ["index"]);
  return root;
}
const evidence = root => { const file = path.join(root, ".spectra/cache/verification/evidence.json"); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).records : []; };

test("P2: a package-local binary resolves for a test target, and the result is recorded", { skip: !posix }, () => {
  const root = binProject();
  const run = spectra(root, ["verify", "--test-target", "node:test-target:.:test:localbin"]);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const record = evidence(root).find(entry => entry.testTarget === "node:test-target:.:test:localbin");
  assert.equal(record?.result, "passed");
});

test("P2: a missing binary still fails with its status and records no evidence; system commands still resolve", { skip: !posix }, () => {
  const root = binProject();
  const missing = spectra(root, ["verify", "--test-target", "node:test-target:.:test:missing"]);
  assert.notEqual(missing.status, 0);
  assert.equal(evidence(root).some(entry => entry.testTarget === "node:test-target:.:test:missing"), false, "no false evidence");
  const system = spectra(root, ["verify", "--test-target", "node:test-target:.:test:system"]);
  assert.equal(system.status, 0, system.stdout + system.stderr);
});

test("P2: the .bin of the target's own directory is used for a nested package", { skip: !posix }, () => {
  const root = createGitProject();
  write(path.join(root, "package.json"), JSON.stringify({ name: "company-project", version: "1.0.0", private: true, workspaces: ["packages/*"] }));
  write(path.join(root, "packages/api/package.json"), JSON.stringify({ name: "api", version: "1.0.0", scripts: { "test:local": "api-only-tool" } }));
  write(path.join(root, "packages/api/node_modules/.bin/api-only-tool"), "#!/bin/sh\nexit 0\n", 0o755);
  git(root, "add", "-A"); git(root, "commit", "-qm", "app");
  ok(root, ["init", ".", "--git-mode", "local"]);
  ok(root, ["index"]);
  const ids = JSON.parse(ok(root, ["index", "--format", "json"]).stdout).records.filter(record => record.kind === "test-target").map(record => record.id);
  const target = ids.find(id => /packages\/api.*:test:local$/.test(id));
  assert.ok(target, `nested target missing from ${JSON.stringify(ids)}`);
  const run = spectra(root, ["verify", "--test-target", target]);
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
