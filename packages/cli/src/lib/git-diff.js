import { spawnSync } from "node:child_process";

function isGitRepo(repoRoot) {
  return (
    spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: repoRoot,
      stdio: "ignore"
    }).status === 0
  );
}

function getCurrentCommit(repoRoot) {
  if (!isGitRepo(repoRoot)) {
    return null;
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return result.status === 0 ? result.stdout.trim() : null;
}

function collectGitDiff(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getChangedFiles(repoRoot, { base = null, head = null, includeWorktree = true, sort = true } = {}) {
  if (!isGitRepo(repoRoot)) {
    return [];
  }

  const seen = new Set();
  const addFiles = (files) => {
    for (const file of files) {
      seen.add(file);
    }
  };

  if (base) {
    addFiles(collectGitDiff(repoRoot, ["diff", "--name-only", base, head ?? "HEAD"]));
  }

  if (includeWorktree || !base) {
    addFiles(collectGitDiff(repoRoot, ["diff", "--name-only", "HEAD"]));
    addFiles(collectGitDiff(repoRoot, ["diff", "--cached", "--name-only"]));
    addFiles(collectGitDiff(repoRoot, ["ls-files", "--others", "--exclude-standard"]));
  }

  return sort ? [...seen].sort() : [...seen];
}


export { collectGitDiff, getCurrentCommit, getChangedFiles, isGitRepo };
