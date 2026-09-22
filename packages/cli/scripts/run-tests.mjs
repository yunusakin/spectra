#!/usr/bin/env node
// Discovers test files under test/ and src/ and runs them with `node --test`.
//
// Explicit file arguments keep discovery identical across supported Node
// versions (>=20): directory arguments are not portable, and bare
// `node --test` discovery executes every .js file under any `test/`
// directory — including fixtures — with cross-version syntax-detection
// differences. This script applies Node's own test-file naming conventions
// while skipping fixtures, build output, and dependencies.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const searchRoots = ["test", "src"];
const skipDirs = new Set(["node_modules", "fixtures", "dist", ".git"]);

// Mirrors Node's default test-file naming conventions:
//   test.js / test.cjs / test.mjs
//   test-*.js / test-*.cjs / test-*.mjs
//   *.test.js / *-test.js / *_test.js (and .cjs/.mjs variants)
function isTestFile(name) {
  return (
    /^test\.(?:cjs|mjs|js)$/.test(name) ||
    /^test-.+\.(?:cjs|mjs|js)$/.test(name) ||
    /.+[._-]test\.(?:cjs|mjs|js)$/.test(name)
  );
}

function collect(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      collect(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && isTestFile(entry.name)) {
      acc.push(path.relative(packageRoot, path.join(dir, entry.name)));
    }
  }
}

const files = [];
for (const root of searchRoots) {
  collect(path.join(packageRoot, root), files);
}
files.sort();

if (files.length === 0) {
  console.error(`No test files found under: ${searchRoots.join(", ")}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: packageRoot,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
