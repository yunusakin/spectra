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

  // Order matters. Moving sdd/ is what flips detectLayout() to "canonical",
  // and this layout's .spectra/install.json already exists (pre-3.0 data
  // directory), so nothing after that move could ever be told apart from a
  // finished migration on retry. Everything that can fail or be repeated —
  // Git exclusions, metadata, config, doc moves — therefore runs first and
  // is idempotent; sdd/ moves last, and a failed attempt stays retryable
  // as a plain "root-sdd" layout.
  ensureDirectory(layout.root);
  if (gitMode === "local") {
    normalizeLocalExclusions(absoluteRoot);
  }
  const metadata = writeMigratedMetadata(layout, oldMetadata, {
    profile,
    gitMode,
    installMode: oldMetadata.installMode ?? "adopt"
  });
  fs.writeFileSync(layout.config, `profile: ${profile}\ngitMode: ${gitMode}\nschemaVersion: ${SCHEMA_VERSION}\n`);
  for (const [sourcePath, targetPath] of docMoves) {
    movePath(sourcePath, targetPath);
  }
  movePath(legacySdd, sddTarget);
  copyDirectory(path.join(getProfileAssetsDir(profile), "sdd", "memory-bank"), path.join(layout.sdd, "memory-bank"));

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

  // install.json is rewritten (not moved) below, and sdd/ moves last: the
  // sdd/ manifest is what flips detectLayout() to "canonical", and a
  // canonical layout with an install.json is treated as finished on retry.
  // So every step that can fail or be repeated (Git exclusions, metadata)
  // runs first, and until sdd/ has moved a failed attempt is still a plain
  // "spectra-dir" layout that simply re-runs.
  const authoritativeMoves = [];
  for (const entry of fs.readdirSync(legacyRoot, { withFileTypes: true })) {
    if (entry.name === "cache" || entry.name === "install.json") {
      continue;
    }
    authoritativeMoves.push([path.join(legacyRoot, entry.name), path.join(layout.root, entry.name)]);
  }
  authoritativeMoves.sort(([a], [b]) => Number(path.basename(a) === "sdd") - Number(path.basename(b) === "sdd"));
  preflightMoves(authoritativeMoves);

  ensureDirectory(layout.root);
  if (gitMode === "local") {
    normalizeLocalExclusions(absoluteRoot);
  }
  const metadata = writeMigratedMetadata(layout, oldMetadata, {
    profile,
    gitMode,
    installMode: oldMetadata.installMode ?? "adopt"
  });

  for (const [sourcePath, targetPath] of authoritativeMoves) {
    movePath(sourcePath, targetPath);
  }
  mergeCacheDirectories(path.join(legacyRoot, "cache"), path.join(layout.root, "cache"));

  // Removed last so a failure above never leaves spectra/ half-deleted.
  fs.rmSync(legacyRoot, { recursive: true, force: true });

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
  if (layout === "canonical") {
    // A canonical sdd/ manifest without install.json, or a leftover
    // legacy spectra/ directory beside an otherwise-complete install,
    // both mean a prior migration didn't fully finish (see
    // migrateLegacyLayout()). Report these as needing a migration pass
    // so callers that gate on needsMigration() — `spectra update` in
    // particular — route through migrateLegacyLayout() and surface its
    // specific error, instead of failing later with a generic message
    // or silently ignoring the leftover directory forever.
    return (
      !fs.existsSync(getProjectLayout(absoluteRoot).installMetadata) ||
      fs.existsSync(path.join(absoluteRoot, "spectra"))
    );
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

  // Checked unconditionally, before layout detection: a root-level sdd/
  // with repo_mode=canonical marks this as the Spectra source repo
  // itself, never a consumer install. detectLayout() prefers a
  // .spectra/sdd/ manifest when one exists (e.g. left behind by an
  // earlier accidental `init`), which would otherwise let this guard be
  // bypassed permanently once that stray directory appears.
  if (isSourceRepository(absoluteRoot)) {
    return { migrated: false, reason: "source-repo" };
  }

  const detected = detectLayout(absoluteRoot);

  if (detected === "canonical") {
    // A canonical sdd/ manifest without install.json means an earlier
    // migration moved content into place and then failed before writing
    // metadata (e.g. Git exclusions couldn't be updated). Treating that
    // as "already migrated" would hide a broken, half-finished install.
    if (!fs.existsSync(layout.installMetadata)) {
      throw new Error(
        `Incomplete migration detected: ${layout.root} has sdd/ but no install.json. ` +
        "Investigate and repair or remove the .spectra directory before retrying."
      );
    }
    // A spectra/ directory beside a complete .spectra/ install has two
    // very different possible origins, and we can tell them apart:
    //
    // - migrateSpectraDirLayout() MOVES every child of spectra/ into
    //   .spectra/ (renameSync) except cache/, which is only COPIED. So if
    //   its final rmSync(legacyRoot) failed after everything else
    //   succeeded, spectra/ contains nothing but that regenerable cache/.
    //   That is a provably harmless leftover; finish the cleanup.
    //
    // - Anything else in spectra/ (sdd/, install.json, docs, ...) cannot
    //   have come from that failure: it is a second, independent tree
    //   (e.g. an old backup restored after .spectra/ was already in use)
    //   that may hold content .spectra/ doesn't. We can't tell which side
    //   is authoritative, so leave it untouched and make the human choose.
    const legacyRoot = path.join(absoluteRoot, "spectra");
    if (fs.existsSync(legacyRoot)) {
      const conflictingEntries = fs.readdirSync(legacyRoot).filter((name) => name !== "cache");
      if (conflictingEntries.length > 0) {
        throw new Error(
          `Conflicting legacy layout: ${legacyRoot} contains ${conflictingEntries.join(", ")} ` +
          `alongside a complete ${layout.root} install. Neither tree was modified. ` +
          "Compare them and merge or remove spectra/ manually before retrying."
        );
      }
      fs.rmSync(legacyRoot, { recursive: true, force: true });
    }
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
