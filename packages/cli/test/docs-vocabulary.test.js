import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const docRoots = ["docs", "profiles/full/docs", "packages/templates/assets/profiles/full/docs", "site"];
const docFiles = ["README.md", "packages/cli/README.md", "scripts/README.md", "packages/core/assets/runtime/scripts/README.md"];

function collect(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(md|html)$/.test(entry.name)) out.push(full);
  }
}

const files = docFiles.map((f) => path.join(repoRoot, f)).filter((f) => fs.existsSync(f));
for (const root of docRoots) {
  if (fs.existsSync(path.join(repoRoot, root))) collect(path.join(repoRoot, root), files);
}
const STALE = [
  [/spectra (eval run|skills resolve|adapters generate|spec diff|context-pack|discuss-task)\b/, "legacy command form"],
  [/generated layout is `spectra\/`/, "3.0.8 layout claim"],
  [/verify v2/i, "stale product vocabulary"],
  [/\.\/spectra\/bin\b/, "3.0.8 launcher path"],
  [/(?<![\w./$-])spectra\/sdd\b/, "3.0.8 sdd path"],
  [/`\/spectra\/`/, "3.0.8 Git exclude pattern"],
  [/does not (use|create)[\s\S]*?`\.spectra\/`[\s\S]*?\bcanonical\b/i, "lists .spectra/ as non-canonical (self-contradictory)"],
  [/does not create root-level `\.spectra\/`/i, "lists .spectra/ as a directory Spectra does not create"],
  [/--profile\s+(?:<lite\|full>|full|lite)|spectra upgrade|spectra verify[^\n]*--profile|\bLite (?:profile|is the default)|\bFull profile\b|keeps profile, Git policy/i, "removed installation profile guidance"]
];

test("docs teach canonical commands and paths only", { skip: files.length === 0 }, () => {
  const problems = [];
  for (const file of files) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      for (const [pattern, label] of STALE) {
        if (pattern.test(line)) problems.push(`${path.relative(repoRoot, file)}:${index + 1} ${label}: ${line.trim()}`);
      }
      if (/spectra admin/.test(line) && !/compatibility alias|still works/.test(line) && !/spectra admin &lt;command&gt;/.test(line)) {
        problems.push(`${path.relative(repoRoot, file)}:${index + 1} spectra admin taught as current: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(problems, []);
});
