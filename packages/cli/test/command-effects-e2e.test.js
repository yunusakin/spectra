import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createGitProject, localSpectra, spectra } from "./helpers/project.js";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const commands = "init adopt onboard context task route knowledge index check verify status update doctor approve eval diff quick skills adapters version help".split(" ");

// Failure modes: omitted public command/mode, stale installed guide, diagrams
// absent, hidden cache or governance writes, falsely read-only operations,
// missing artifact, repeated commands destroy user files, app code changes.
test("documented command effects match installed CLI behavior and retain evidence", t => {
  const guide = fs.readFileSync(path.join(repo, "docs/cli-reference.md"), "utf8");
  assert.equal(fs.readFileSync(path.join(repo, "profiles/full/docs/cli-reference.md"), "utf8"), guide);
  for (const command of commands) assert.ok(guide.includes(`## ${command}\n`), `Missing command: ${command}`);
  assert.equal((guide.match(/```mermaid/g) ?? []).length, 3);
  assert.match(guide, /--task <legacy_pack>/);
  const root = createGitProject();
  t.diagnostic(`Temporary command project: ${root}`);
  const steps = [];
  const inventory = () => {
    const files = {};
    const visit = (dir, prefix = "") => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (relative === ".git") continue;
        if (entry.isDirectory()) visit(path.join(dir, entry.name), relative);
        else if (entry.isFile()) files[relative] = createHash("sha256").update(fs.readFileSync(path.join(dir, entry.name))).digest("hex");
      }
    };
    visit(root);
    const exclude = path.join(root, ".git/info/exclude");
    if (fs.existsSync(exclude)) files[".git/info/exclude"] = createHash("sha256").update(fs.readFileSync(exclude)).digest("hex");
    return files;
  };
  const execute = (args, expected = 0, invoke = localSpectra) => {
    const before = inventory();
    const result = invoke(root, args);
    const after = inventory();
    const added = Object.keys(after).filter(file => !(file in before));
    const changed = Object.keys(after).filter(file => file in before && before[file] !== after[file]);
    const removed = Object.keys(before).filter(file => !(file in after));
    steps.push({ command: ["spectra", ...args], exitCode: result.status, before, after, added, changed, removed, stdout: result.stdout, stderr: result.stderr });
    assert.equal(result.status, expected, `${result.stdout}\n${result.stderr}`);
    return { added, changed, removed, result };
  };
  execute(["init", "."], 0, spectra);
  assert.ok(fs.existsSync(path.join(root, ".spectra/docs/spectra/cli-reference.md")));
  assert.equal(fs.readFileSync(path.join(root, ".spectra/docs/spectra/cli-reference.md"), "utf8"), guide);
  for (const command of commands) {
    const effects = execute([command, "--help"]);
    assert.deepEqual([...effects.added, ...effects.changed, ...effects.removed], [], `${command} --help writes files`);
  }
  execute(["index", "--check"], 1);
  assert.ok(execute(["index"]).added.includes(".spectra/cache/index/repo-index.json"));
  for (const args of [["index", "--check"], ["route", "--task", "inspect"], ["status"], ["version"], ["help"]]) {
    const effects = execute(args);
    assert.deepEqual([...effects.added, ...effects.changed, ...effects.removed], [], `${args.join(" ")} writes files`);
  }
  assert.ok(execute(["context", "--role", "planner", "--goal", "discover"]).added.some(file => file.startsWith(".spectra/cache/context/")));
  assert.ok(execute(["task", "--item", "TASK-001", "--task-type", "feature", "--goal", "Document effects"]).changed.includes(".spectra/sdd/memory-bank/core/implementation-brief.md"));
  const addedRule = execute(["knowledge", "add", "--domain", "billing", "--title", "Example rule", "--statement", "Draft invoices require review."]);
  assert.ok(addedRule.added.includes(".spectra/sdd/memory-bank/business/billing/unresolved.md"));
  const id = addedRule.result.stdout.match(/Business rule recorded: (\S+)/)[1];
  execute(["knowledge", "promote", "--id", id]);
  execute(["knowledge", "supersede", "--id", id]);
  execute(["knowledge", "deprecate", "--id", id]);
  assert.ok(execute(["adapters", "--agents", "claude"]).added.includes("CLAUDE.md"));
  const adapter = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
  execute(["adapters", "--agents", "claude"]);
  assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), adapter);
  assert.ok(execute(["diff", "init"]).changed.includes(".spectra/sdd/memory-bank/core/spec-diff.md"));
  execute(["diff", "update"]);
  // --stdout still initializes a missing report in the current implementation.
  const report = path.join(root, ".spectra/sdd/memory-bank/core/spec-diff.md");
  fs.rmSync(report);
  assert.ok(execute(["diff", "init", "--stdout"]).added.includes(".spectra/sdd/memory-bank/core/spec-diff.md"));
  execute(["diff", "semantic"]);
  execute(["eval", "--suite", "smoke"]);
  assert.ok(fs.readdirSync(path.join(root, ".spectra/sdd/features")).some(feature => fs.existsSync(path.join(root, ".spectra/sdd/features", feature, "evals/reports/latest.json"))));
  execute(["verify"], 1); // Draft project: failed readiness still writes eval reports.
  execute(["doctor"]);
  const userPath = path.join(root, ".spectra/docs/custom-plugin/plan.md");
  fs.mkdirSync(path.dirname(userPath), { recursive: true });
  fs.writeFileSync(userPath, "# Preserve this plan\n");
  execute(["doctor", "--fix"]);
  assert.equal(fs.readFileSync(userPath, "utf8"), "# Preserve this plan\n");
  assert.equal(fs.readFileSync(path.join(root, "package.json"), "utf8"), '{"name":"company-project"}\n');
  const artifact = path.join(root, ".spectra/cache/command-effects-e2e.json");
  fs.writeFileSync(artifact, JSON.stringify({ root, steps }, null, 2));
  t.diagnostic(`Command effects artifact: ${artifact}`);
});
