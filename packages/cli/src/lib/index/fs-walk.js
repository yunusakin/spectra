import fs from "node:fs";
import path from "node:path";

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "bin",
  "obj",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
  ".idea",
  ".vscode",
  ".gradle",
  ".mvn",
  "spectra",
  ".spectra"
]);

function toPosixRelative(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

// Bounded walk: skips heavy/generated directories and caps depth so large
// monorepos stay cheap to scan. Returns absolute paths of files whose
// basename matches one of `fileNames`.
function findManifestFiles(repoRoot, fileNames, { maxDepth = 8 } = {}) {
  const targets = new Set(fileNames);
  const matches = [];

  function walk(dir, depth) {
    if (depth > maxDepth) {
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) {
          continue;
        }
        walk(path.join(dir, entry.name), depth + 1);
        continue;
      }
      if (entry.isFile() && targets.has(entry.name)) {
        matches.push(path.join(dir, entry.name));
      }
    }
  }

  walk(repoRoot, 0);
  return matches.sort();
}

function findFilesByExtension(repoRoot, extensions, { maxDepth = 8, maxMatches = 5000 } = {}) {
  const exts = new Set(extensions);
  const matches = [];

  function walk(dir, depth) {
    if (depth > maxDepth || matches.length >= maxMatches) {
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (matches.length >= maxMatches) {
        return;
      }
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) {
          continue;
        }
        walk(path.join(dir, entry.name), depth + 1);
        continue;
      }
      if (entry.isFile() && exts.has(path.extname(entry.name))) {
        matches.push(path.join(dir, entry.name));
      }
    }
  }

  walk(repoRoot, 0);
  return matches.sort();
}

function readTextFile(absolutePath) {
  return fs.readFileSync(absolutePath, "utf8");
}

function statSignature(absolutePath) {
  const stat = fs.statSync(absolutePath);
  return `${absolutePath}:${stat.mtimeMs}:${stat.size}`;
}

export {
  DEFAULT_IGNORE_DIRS,
  toPosixRelative,
  findManifestFiles,
  findFilesByExtension,
  readTextFile,
  statSignature
};
