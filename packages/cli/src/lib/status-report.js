import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const RESUME_FILES = new Set([
  "spectra/sdd/memory-bank/core/activeContext.md",
  "spectra/sdd/memory-bank/core/implementation-brief.md",
  "spectra/sdd/memory-bank/core/progress.md"
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function collectRecentFiles(projectRoot, { limit = 8 } = {}) {
  const files = [];
  const metadataPath = path.join(projectRoot, "spectra", "install.json");
  const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : {};
  const installedAt = Date.parse(metadata.installedAt ?? "") || 0;
  const candidates = [...RESUME_FILES].map((relativePath) => path.join(projectRoot, relativePath));

  for (const absolutePath of candidates) {
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    const modifiedAt = fs.statSync(absolutePath).mtimeMs;
    if (modifiedAt <= installedAt) {
      continue;
    }
    files.push({ path: toPosix(path.relative(projectRoot, absolutePath)), modifiedAt });
  }

  return files
    .sort((left, right) => right.modifiedAt - left.modifiedAt || left.path.localeCompare(right.path))
    .slice(0, limit)
    .map((entry) => entry.path);
}

function collectLatestCommitPaths(projectRoot) {
  const result = spawnSync("git", ["-C", projectRoot, "show", "--name-only", "--pretty=format:", "--no-renames", "HEAD"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function collectGitChanges(projectRoot) {
  const result = spawnSync("git", ["-C", projectRoot, "status", "--short", "--untracked-files=all"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

function buildStatusReport(projectRoot) {
  const changes = collectGitChanges(projectRoot);
  const committed = collectLatestCommitPaths(projectRoot);
  const recentFiles = collectRecentFiles(projectRoot);
  return {
    recentUpdates: [...new Set([...changes, ...committed, ...recentFiles])].slice(0, 8),
    hasUncommittedChanges: changes.length > 0
  };
}

export { buildStatusReport };
