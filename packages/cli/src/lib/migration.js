import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { detectLayout, getProjectLayout } from "./project-layout.js";
import { createInstallMetadata, SCHEMA_VERSION } from "./profile.js";
import { copyDirectory, ensureDirectory, getProfileAssetsDir } from "./runtime.js";

// Patterns that describe Spectra's old homes. They are stripped during
// migration and replaced with the canonical /.spectra/ exclusion.
const LEGACY_EXCLUSIONS = new Set([
  "spectra/",
  "/spectra/",
  "sdd/",
  "/sdd/",
  "docs/",
  "/docs/",
  ".spectra/"
]);
const CANONICAL_EXCLUSION = "/.spectra/";

function movePath(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  if (fs.existsSync(targetPath)) {
    throw new Error(`Migration conflict: ${targetPath} already exists.`);
  }
  ensureDirectory(path.dirname(targetPath));
  fs.renameSync(sourcePath, targetPath);
}

function listRelativeFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const files = [];
  function visit(directory, relativeDir = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        visit(path.join(directory, entry.name), relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }
  visit(rootDir);
  return files;
}

function knownDocMoves(projectRoot, profile, targetDocsRoot) {
  const sourceDocsRoot = path.join(projectRoot, "docs");
  const profileDocsRoot = path.join(getProfileAssetsDir(profile), "docs");
  const moves = [];
  for (const relativePath of listRelativeFiles(profileDocsRoot)) {
    const sourcePath = path.join(sourceDocsRoot, relativePath);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    moves.push([sourcePath, path.join(targetDocsRoot, relativePath)]);
  }
  return moves;
}

function normalizeExcludeLines(lines) {
  const normalized = lines.filter((line) => line !== "" && !LEGACY_EXCLUSIONS.has(line));
  if (!normalized.includes(CANONICAL_EXCLUSION)) {
    normalized.push(CANONICAL_EXCLUSION);
  }
  return normalized;
}

function normalizeLocalExclusions(projectRoot) {
  const result = spawnSync("git", ["-C", projectRoot, "rev-parse", "--git-path", "info/exclude"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error("Cannot migrate local Git mode outside a Git worktree.");
  }
  const excludePath = path.isAbsolute(result.stdout.trim())
    ? result.stdout.trim()
    : path.resolve(projectRoot, result.stdout.trim());
  const current = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, "utf8").split(/\r?\n/) : [];
  const normalized = normalizeExcludeLines(current);
  ensureDirectory(path.dirname(excludePath));
  fs.writeFileSync(excludePath, `${normalized.join("\n")}\n`);
}

function preflightMoves(moves) {
  for (const [sourcePath, targetPath] of moves) {
    if (fs.existsSync(sourcePath) && fs.existsSync(targetPath)) {
      throw new Error(`Migration conflict: ${targetPath} already exists.`);
    }
  }
}

function isSourceRepository(projectRoot) {
  const manifestPath = path.join(projectRoot, "sdd", "system", "manifest.env");
  if (!fs.existsSync(manifestPath)) {
    return false;
  }
  const content = fs.readFileSync(manifestPath, "utf8");
  return /^repo_mode=canonical$/m.test(content);
}

function readMetadata(metadataPath) {
  if (!fs.existsSync(metadataPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch {
    return {};
  }
}

function writeMigratedMetadata(layout, oldMetadata, { profile, gitMode, installMode }) {
  const excludePatterns = gitMode === "local"
    ? [...new Set([...(oldMetadata.excludePatterns ?? []).filter((pattern) => !LEGACY_EXCLUSIONS.has(pattern)), CANONICAL_EXCLUSION])]
    : oldMetadata.excludePatterns ?? [];
  const metadata = {
    ...oldMetadata,
    ...createInstallMetadata({ profile, gitMode, installMode }),
    localLauncher: ".spectra/bin/spectra",
    excludePatterns
  };
  ensureDirectory(path.dirname(layout.installMetadata));
  fs.writeFileSync(layout.installMetadata, JSON.stringify(metadata, null, 2));
  return metadata;
}

// Pre-3.0 layout: root-level sdd/ (plus optional root docs/) with a
// .spectra/ data directory. The data directory already has the canonical
// name, so migration moves sdd/ and known docs into it.
function migrateRootSddLayout(absoluteRoot, layout) {
  if (isSourceRepository(absoluteRoot)) {
    return { migrated: false, reason: "source-repo" };
  }

  const legacyInstall = path.join(absoluteRoot, ".spectra", "install.json");
  const legacySdd = path.join(absoluteRoot, "sdd");
  if (!fs.existsSync(legacyInstall) && !fs.existsSync(legacySdd)) {
    return { migrated: false, reason: "not-installed" };
  }

  const oldMetadata = readMetadata(legacyInstall);
  const profile = oldMetadata.profile === "lite" ? "lite" : "full";
  const gitMode = oldMetadata.gitMode ?? "shared";

  const sddTarget = path.join(layout.root, "sdd");
  const docsTarget = path.join(layout.root, "docs");
  const docMoves = knownDocMoves(absoluteRoot, profile, docsTarget);
  preflightMoves([
    [legacySdd, sddTarget],
    ...docMoves
  ]);

  ensureDirectory(layout.root);
  movePath(legacySdd, sddTarget);
  for (const [sourcePath, targetPath] of docMoves) {
    movePath(sourcePath, targetPath);
  }
  copyDirectory(path.join(getProfileAssetsDir(profile), "sdd", "memory-bank"), path.join(layout.sdd, "memory-bank"));

  if (gitMode === "local") {
    normalizeLocalExclusions(absoluteRoot);
  }

  const metadata = writeMigratedMetadata(layout, oldMetadata, {
    profile,
    gitMode,
    installMode: oldMetadata.installMode ?? "adopt"
  });
  fs.writeFileSync(layout.config, `profile: ${profile}\ngitMode: ${gitMode}\nschemaVersion: ${SCHEMA_VERSION}\n`);

  return { migrated: true, profile, gitMode, localLauncher: metadata.localLauncher };
}

// 3.0.8 layout: everything under spectra/. Move each child into
// .spectra/; the derived cache/ directory is merged file-by-file
// (target wins) because it is regenerable state.
function mergeCacheDirectories(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }
  for (const relativePath of listRelativeFiles(sourceDir)) {
    const sourcePath = path.join(sourceDir, relativePath);
    const targetPath = path.join(targetDir, relativePath);
    if (fs.existsSync(targetPath)) {
      continue;
    }
    ensureDirectory(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function migrateSpectraDirLayout(absoluteRoot, layout) {
  const legacyRoot = path.join(absoluteRoot, "spectra");
  const oldMetadata = readMetadata(path.join(legacyRoot, "install.json"));
  const profile = oldMetadata.profile === "lite" ? "lite" : "full";
  const gitMode = oldMetadata.gitMode ?? "shared";

  const authoritativeMoves = [];
  for (const entry of fs.readdirSync(legacyRoot, { withFileTypes: true })) {
    if (entry.name === "cache") {
      continue;
    }
    authoritativeMoves.push([path.join(legacyRoot, entry.name), path.join(layout.root, entry.name)]);
  }
  preflightMoves(authoritativeMoves);

  ensureDirectory(layout.root);
  for (const [sourcePath, targetPath] of authoritativeMoves) {
    movePath(sourcePath, targetPath);
  }
  mergeCacheDirectories(path.join(legacyRoot, "cache"), path.join(layout.root, "cache"));
  fs.rmSync(legacyRoot, { recursive: true, force: true });

  if (gitMode === "local") {
    normalizeLocalExclusions(absoluteRoot);
  }

  const metadata = writeMigratedMetadata(layout, oldMetadata, {
    profile,
    gitMode,
    installMode: oldMetadata.installMode ?? "adopt"
  });

  return { migrated: true, profile, gitMode, localLauncher: metadata.localLauncher };
}

// Cheap, side-effect-free check used by update/init/adopt to decide
// whether a migration pass is required.
function needsMigration(projectRoot) {
  const absoluteRoot = path.resolve(projectRoot);
  const layout = detectLayout(absoluteRoot);
  if (layout === "spectra-dir" || layout === "root-sdd") {
    return true;
  }
  if (layout === null) {
    return (
      fs.existsSync(path.join(absoluteRoot, ".spectra", "install.json")) ||
      fs.existsSync(path.join(absoluteRoot, "sdd"))
    );
  }
  return false;
}

function migrateLegacyLayout(projectRoot) {
  const absoluteRoot = path.resolve(projectRoot);
  const layout = getProjectLayout(absoluteRoot);
  const detected = detectLayout(absoluteRoot);

  if (detected === "canonical") {
    return { migrated: false, reason: "canonical" };
  }
  if (detected === "spectra-dir") {
    return migrateSpectraDirLayout(absoluteRoot, layout);
  }
  // detected === "root-sdd", or null with legacy leftovers (metadata-only
  // or a root sdd/ directory without a readable manifest).
  return migrateRootSddLayout(absoluteRoot, layout);
}

export { migrateLegacyLayout, needsMigration };
