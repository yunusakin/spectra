// Spectra's own repository is a root-layout source repository (sdd/system/manifest.env has repo_mode=canonical), so it
// carries copies of the runtime files that consumers receive. Failure modes recorded before any change:
//  S1  root sdd/system lags the consumer source (stale commands, spectra_version=2.0.0)
//  S2  packages/core/assets/runtime/sdd/system lags the consumer source (profiles/full/sdd/system)
//  S3  a root runtime script (scripts/*.sh) lags the packaged runtime script it mirrors
//  S4  root validate-repo.sh (source-specific extras allowed) misses a line of the packaged validator, e.g. a bug fix
// Authoritative sources: profiles/full/sdd/system (system files) and packages/core/assets/runtime/scripts (scripts).
// Refresh the mirrors with: node packages/cli/scripts/sync-assets.mjs --tracked
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createGitProject, spectra } from "./helpers/project.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fix = "run: node packages/cli/scripts/sync-assets.mjs --tracked";

function files(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full));
    }
  };
  walk(dir);
  return out.sort();
}

function compare(sourceDir, mirrorDir, { skip = [] } = {}) {
  const problems = [];
  const source = files(sourceDir).filter((file) => !skip.includes(file));
  const mirror = files(mirrorDir).filter((file) => !skip.includes(file));
  for (const file of source) {
    if (!mirror.includes(file)) problems.push(`missing ${file}`);
    else if (!fs.readFileSync(path.join(sourceDir, file)).equals(fs.readFileSync(path.join(mirrorDir, file)))) problems.push(`differs ${file}`);
  }
  for (const file of mirror) if (!source.includes(file)) problems.push(`extra ${file}`);
  return problems;
}

const consumerSystem = path.join(repo, "profiles", "full", "sdd", "system");
const runtimeScripts = path.join(repo, "packages", "core", "assets", "runtime", "scripts");

test("S1: root sdd/system is the consumer system source, keeps the source-repository marker and the current version", () => {
  assert.deepEqual(compare(consumerSystem, path.join(repo, "sdd", "system")), [], fix);
  const manifest = fs.readFileSync(path.join(repo, "sdd", "system", "manifest.env"), "utf8");
  assert.match(manifest, /^repo_mode=canonical$/m, "the source-repository marker stays");
  const version = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version;
  assert.match(manifest, new RegExp(`^spectra_version=${version.replaceAll(".", "\\.")}$`, "m"), "the root manifest carries the package version");
});

test("S2: the packaged runtime's sdd/system is the consumer system source", () => {
  assert.deepEqual(compare(consumerSystem, path.join(repo, "packages", "core", "assets", "runtime", "sdd", "system")), [], fix);
});

test("S3: root scripts mirror the packaged runtime scripts; validate-repo.sh may only add source-specific lines", () => {
  assert.deepEqual(compare(runtimeScripts, path.join(repo, "scripts"), { skip: ["validate-repo.sh"] }), [], fix);
  const packaged = fs.readFileSync(path.join(runtimeScripts, "validate-repo.sh"), "utf8").split("\n");
  const root = fs.readFileSync(path.join(repo, "scripts", "validate-repo.sh"), "utf8").split("\n");
  // Bare shell punctuation (`fi`, `done`, `}`) appears everywhere, so a match proves nothing: only meaningful lines are
  // checked. They must appear in order, and as often as in the packaged validator, so a dropped duplicate is caught too.
  const trivial = (line) => /^(?:fi|done|else|then|do|esac|[\s\W]*)$/.test(line.trim());
  const meaningful = packaged.filter((line) => !trivial(line));
  let at = 0;
  const missing = [];
  for (const line of meaningful) {
    const found = root.indexOf(line, at);
    if (found === -1) missing.push(line);
    else at = found + 1;
  }
  const count = (lines, line) => lines.filter((candidate) => candidate === line).length;
  for (const line of new Set(meaningful)) if (count(root, line) < count(packaged, line)) missing.push(`(fewer copies than packaged) ${line}`);
  assert.deepEqual(missing, [], "every meaningful line of the packaged validator must appear, in order and as often, in scripts/validate-repo.sh (add source-only checks, never drop a packaged fix)");
});

// S5  the consumer system source lacked the business-memory guidance, so a freshly initialized project's generated
//     adapters omitted it (the adapter unit test only passed because it generated from the source repository's own copy)
test("S5: adapters generated in a freshly initialized consumer carry the business-memory policy", () => {
  const root = createGitProject();
  const init = spectra(root, ["init", ".", "--agents", "claude,copilot"]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  for (const file of ["CLAUDE.md", ".github/copilot-instructions.md"]) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    for (const marker of [/route-first context/i, /unresolved.*default/i, /verified evidence before active/i, /do not infer business truth from code alone/i]) {
      assert.match(content, marker, `${file} is missing ${marker}`);
    }
  }
});
