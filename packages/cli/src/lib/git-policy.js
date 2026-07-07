import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const VALID_GIT_MODES = new Set(["local", "shared"]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function runGit(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0 && !allowFailure) {
    const detail = result.stderr.trim() || result.stdout.trim() || `git ${args.join(" ")} failed`;
    throw new Error(detail);
  }

  return result;
}

async function resolveGitMode({ requestedMode, isTTY = false, ask } = {}) {
  if (requestedMode !== undefined) {
    if (!VALID_GIT_MODES.has(requestedMode)) {
      throw new Error("--git-mode must be local or shared");
    }
    return requestedMode;
  }

  if (!isTTY) {
    return "shared";
  }

  if (typeof ask !== "function") {
    return "local";
  }

  const selected = await ask({ defaultMode: "local" });
  if (!VALID_GIT_MODES.has(selected)) {
    throw new Error("Git mode must be local or shared");
  }
  return selected;
}

function listFiles(rootDir) {
  const files = [];

  function visit(currentDir, relativeDir = "") {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (relativeDir === "" && entry.name === ".git") {
        continue;
      }

      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else {
        files.push(toPosix(relativePath));
      }
    }
  }

  visit(rootDir);
  return files.sort();
}

function assertNoTrackedSpectraRoots(targetRoot) {
  const result = runGit(targetRoot, ["ls-files", "--", "sdd", ".spectra"]);
  const tracked = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (tracked.length > 0) {
    throw new Error(`Local git mode found tracked Spectra path(s):\n${tracked.join("\n")}`);
  }
}

function assertPathsUntracked(targetRoot, relativePaths, label = "path") {
  if (relativePaths.length === 0) {
    return;
  }
  const result = runGit(targetRoot, ["ls-files", "--", ...relativePaths]);
  const tracked = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (tracked.length > 0) {
    throw new Error(`Local git mode found tracked ${label}(s):\n${tracked.join("\n")}`);
  }
}

function resolveExcludePath(targetRoot) {
  const result = runGit(targetRoot, ["rev-parse", "--git-path", "info/exclude"]);
  const gitPath = result.stdout.trim();
  return path.isAbsolute(gitPath) ? gitPath : path.resolve(targetRoot, gitPath);
}

function beginLocalGitPolicy(targetDir) {
  const requestedTarget = path.resolve(targetDir);
  if (!fs.existsSync(requestedTarget) || !fs.statSync(requestedTarget).isDirectory()) {
    throw new Error(`Local git mode requires an existing Git worktree: ${requestedTarget}`);
  }
  const targetRoot = fs.realpathSync(requestedTarget);

  const rootResult = runGit(targetRoot, ["rev-parse", "--show-toplevel"], { allowFailure: true });
  if (rootResult.status !== 0) {
    throw new Error(`Local git mode requires a Git worktree: ${targetRoot}`);
  }

  const gitRoot = fs.realpathSync(rootResult.stdout.trim());
  const relativeTarget = toPosix(path.relative(gitRoot, targetRoot)) || ".";
  if (relativeTarget === ".." || relativeTarget.startsWith("../")) {
    throw new Error(`Adopt target must be inside its Git worktree: ${targetRoot}`);
  }

  assertNoTrackedSpectraRoots(targetRoot);

  return {
    targetRoot,
    gitRoot,
    relativeTarget,
    excludePath: resolveExcludePath(targetRoot),
    beforeFiles: listFiles(targetRoot),
    rootsExisted: {
      ".spectra": fs.existsSync(path.join(targetRoot, ".spectra")),
      sdd: fs.existsSync(path.join(targetRoot, "sdd"))
    }
  };
}

function patternFor(relativeTarget, relativePath, directory = false) {
  const prefix = relativeTarget === "." ? "" : `${relativeTarget}/`;
  return `/${prefix}${relativePath}${directory ? "/" : ""}`;
}

function buildExcludePatterns(policy, ownedPaths) {
  const broadRoots = [".spectra", "sdd"].filter(
    (root) => !policy.rootsExisted[root] && ownedPaths.some((filePath) => filePath.startsWith(`${root}/`))
  );
  const exactPaths = ownedPaths.filter(
    (filePath) => !broadRoots.some((root) => filePath.startsWith(`${root}/`))
  );

  return [
    ...broadRoots.map((root) => patternFor(policy.relativeTarget, root, true)),
    ...exactPaths.map((filePath) => patternFor(policy.relativeTarget, filePath))
  ].sort();
}

function replaceManagedBlock(content, blockId, patterns) {
  const start = `# >>> spectra local:${blockId}`;
  const end = `# <<< spectra local:${blockId}`;
  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockPattern = new RegExp(`(?:^|\\n)${escapedStart}\\n[\\s\\S]*?\\n${escapedEnd}(?=\\n|$)`, "g");
  const withoutBlock = content.replace(blockPattern, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  const block = [start, ...patterns, end].join("\n");
  return `${withoutBlock}${withoutBlock ? "\n\n" : ""}${block}\n`;
}

function writeManagedExclude(policy, excludePatterns) {
  fs.mkdirSync(path.dirname(policy.excludePath), { recursive: true });
  const current = fs.existsSync(policy.excludePath) ? fs.readFileSync(policy.excludePath, "utf8") : "";
  const next = replaceManagedBlock(current, policy.relativeTarget, excludePatterns);
  fs.writeFileSync(policy.excludePath, next);
}

function finishLocalGitPolicy(policy, existing = {}) {
  const before = new Set(policy.beforeFiles);
  const newOwnedPaths = listFiles(policy.targetRoot).filter((filePath) => !before.has(filePath));
  const ownedPaths = [...new Set([...(existing.ownedPaths ?? []), ...newOwnedPaths])].sort();
  const newPatterns = buildExcludePatterns(policy, newOwnedPaths);
  const previousPatterns = existing.excludePatterns ?? [];
  const excludePatterns = [...new Set([...previousPatterns, ...newPatterns])]
    .filter(
      (candidate) =>
        candidate.endsWith("/") ||
        !previousPatterns.some((pattern) => pattern.endsWith("/") && candidate.startsWith(pattern))
    )
    .sort();
  writeManagedExclude(policy, excludePatterns);
  return {
    ownedPaths,
    excludePatterns,
    excludePath: policy.excludePath
  };
}

export {
  assertPathsUntracked,
  beginLocalGitPolicy,
  buildExcludePatterns,
  finishLocalGitPolicy,
  resolveGitMode
};
