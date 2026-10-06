// Bounded retrieval term folding: -ing / -ed only. Failure modes recorded before any product change:
//  F1  counting and counted do not share a normalized term
//  F2  a relevant invariant stays outside the candidate set because the overlap stays at 1
//  F3  unrelated words become false matches through over-aggressive suffix removal (-ion family, short stems)
//  F4  double-consonant handling produces malformed stems (runn, ad)
//  F5  a new term model is combined with a stale Knowledge Map that still holds old terms
//  F6  explicit semantic-ID retrieval changes
//  F7  the >=2 overlap threshold changes (one folded shared term must stay insufficient)
//  F10 a derived-cache change triggers project schema migration
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { termsOf } from "../src/lib/knowledge/terms.js";
import { getKnowledgeMapPath } from "../src/lib/knowledge/map.js";
import { createGitProject, spectra } from "./helpers/project.js";

const sdd = root => path.join(root, ".spectra", "sdd");
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const ok = (root, args) => { const r = spectra(root, args); assert.equal(r.status, 0, `${args.join(" ")}: ${r.stdout}${r.stderr}`); return r; };
const labels = (root, task) =>
  JSON.parse(ok(root, ["context", "--role", "implementer", "--goal", "implement", "--route-task", task, "--format", "json"]).stdout).entries.filter(entry => entry.source === "resolved").map(entry => entry.label);

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

test("F1/F4: -ing and -ed fold to one stem; short stems, natural doubles and the -ion family are left alone", () => {
  const one = (word) => termsOf(word)[0];
  assert.equal(one("counting"), one("counted"));
  assert.equal(one("counted"), "count");
  assert.equal(one("rejecting"), one("rejected"));
  assert.equal(one("recording"), one("recorded"));
  assert.equal(one("records"), one("recorded"), "the plural fold still runs first");
  assert.equal(one("stopped"), "stop", "doubled consonant restored when the stem stays useful");
  assert.equal(one("installed"), "install", "a natural double (ll) is kept");
  assert.equal(one("running"), "running", "stem 'run' is below the minimum: not folded, never the malformed 'runn'");
  assert.equal(one("added"), "added", "stem 'add' is below the minimum: not folded, never 'ad'");
  for (const word of ["being", "thing", "string", "speed"]) assert.equal(one(word), word, `${word} has no useful stem`);
  assert.notEqual(one("project"), one("projection"));
  assert.notEqual(one("product"), one("production"));
  assert.notEqual(one("general"), one("generation"));
  assert.notEqual(one("valid"), one("validation"));
});

test("F3: a folded form never re-admits a STOP term", () => {
  assert.deepEqual(termsOf("willing"), [], "'willing' would fold to the STOP term 'will'");
  assert.deepEqual(termsOf("rules"), []);
});

test("F1/F2: the B2 miss — 'assertion counting' retrieves the invariant stating 'counted'; an unrelated invariant is not pulled in", () => {
  const root = featureProject("plan-like", [["INV-1", "Every exposed assertion method is counted exactly once."], ["INV-2", "Reports are encoded as UTF-8 text."]]);
  const got = labels(root, "Understand how assertion counting is verified");
  assert.ok(got.includes("plan-like#INV-1"), `INV-1 missing from ${JSON.stringify(got)}`);
  assert.ok(!got.includes("plan-like#INV-2"), "an unrelated invariant must not be selected");
});

test("F1: folding works beyond the B2 phrase (reject/rejected, record/recorded)", () => {
  const root = featureProject("intake", [["INV-1", "Every rejected request is recorded exactly once."], ["INV-2", "Currency codes follow the three letter ISO format."]]);
  const got = labels(root, "Review rejecting and recording of requests");
  assert.ok(got.includes("intake#INV-1"), `INV-1 missing from ${JSON.stringify(got)}`);
  assert.ok(!got.includes("intake#INV-2"));
});

test("F7: one folded shared term is still not enough (threshold stays 2)", () => {
  const root = featureProject("plan-like", [["INV-1", "Every exposed assertion method is counted exactly once."]]);
  assert.ok(!labels(root, "Describe counting behavior").includes("plan-like#INV-1"));
});

test("F3: project/projection do not become one term, so one real overlap plus that pair selects nothing", () => {
  const root = featureProject("render", [["INV-1", "The projection of ledger entries is stable."]]);
  assert.ok(!labels(root, "Change ledger project setup").includes("render#INV-1"));
});

test("F6: explicit semantic-ID retrieval is unchanged", () => {
  const root = featureProject("plan-like", [["INV-1", "Every exposed assertion method is counted exactly once."]]);
  assert.ok(labels(root, "Review plan-like#INV-1").includes("plan-like#INV-1"));
  assert.equal(JSON.parse(ok(root, ["inspect", "plan-like#INV-1", "--json"]).stdout).subject.kind, "architectural-invariant");
  assert.equal(JSON.parse(ok(root, ["verify", "--explain", "plan-like#INV-1", "--json"]).stdout).id, "plan-like#INV-1");
});

test("F5/F10: a Knowledge Map written under the old term model is discarded and rebuilt without touching canonical state or the project schema", () => {
  const root = featureProject("plan-like", [["INV-1", "Every exposed assertion method is counted exactly once."]]);
  ok(root, ["context", "--role", "implementer", "--goal", "implement", "--route-task", "Understand how assertion counting is verified", "--format", "json"]);
  const mapPath = getKnowledgeMapPath(root);
  // an old-model map: previous contract version, terms as the unfolded model stored them
  const old = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  old.contractVersion = 5;
  for (const reference of old.references) if (reference.id === "plan-like#INV-1") reference.terms = ["assertion", "counted", "exactly", "exposed", "method", "once", "every"].sort();
  fs.writeFileSync(mapPath, JSON.stringify(old));
  const snapshot = () => ({
    canonical: fs.readFileSync(path.join(sdd(root), "features", "plan-like", "feature.spec.yaml"), "utf8"),
    install: fs.readFileSync(path.join(root, ".spectra", "install.json"), "utf8")
  });
  const before = snapshot();
  const got = labels(root, "Understand how assertion counting is verified");
  assert.ok(got.includes("plan-like#INV-1"), `retrieval after the rebuild: ${JSON.stringify(got)}`);
  const rebuilt = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  assert.ok(rebuilt.contractVersion > 5, "the map contract version moved");
  assert.ok(rebuilt.references.find(reference => reference.id === "plan-like#INV-1").terms.includes("count"), "folded terms are stored");
  assert.deepEqual(snapshot(), before, "canonical knowledge and the project schema/install record are untouched");
  assert.equal(JSON.parse(before.install).schemaVersion, JSON.parse(snapshot().install).schemaVersion);
});
