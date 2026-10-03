import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import { detectLayout, getProjectLayout } from "./project-layout.js";
import { ensureDirectory, getProjectAssetsDir } from "./runtime.js";

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
      if (entry.isSymbolicLink()) throw new Error(`Unsafe migration symlink: ${path.join(directory, entry.name)}`);
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

function knownDocMoves(projectRoot, targetDocsRoot) {
  const sourceDocsRoot = path.join(projectRoot, "docs");
  const profileDocsRoot = path.join(getProjectAssetsDir(), "docs");
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

// Only lines Spectra itself recorded in install.json are removable; an
// identical-looking rule the user added (e.g. /docs/) must survive.
function normalizeExcludeLines(lines, ownedPatterns) {
  const owned = new Set(ownedPatterns);
  const normalized = lines.filter((line) => line !== "" && !(LEGACY_EXCLUSIONS.has(line) && owned.has(line)));
  if (!normalized.includes(CANONICAL_EXCLUSION)) {
    normalized.push(CANONICAL_EXCLUSION);
  }
  return normalized;
}

function normalizeLocalExclusions(projectRoot, ownedPatterns = []) {
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
  const normalized = normalizeExcludeLines(current, ownedPatterns);
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
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error(`Malformed ${metadataPath}: expected an object.`);
  return metadata;
}

function configGitMode(metadataPath) {
  const file = path.join(path.dirname(metadataPath), "config.yaml");
  if (!fs.existsSync(file)) return undefined;
  const config = parse(fs.readFileSync(file, "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error(`Malformed ${file}: expected an object.`);
  return config.gitMode;
}

function writeMigratedMetadata(layout, oldMetadata, { gitMode, installMode }) {
  const previousMetadata = oldMetadata;
  const excludePatterns = gitMode === "local"
    ? [...new Set([...(oldMetadata.excludePatterns ?? []).filter((pattern) => !LEGACY_EXCLUSIONS.has(pattern)), CANONICAL_EXCLUSION])]
    : oldMetadata.excludePatterns ?? [];
  const metadata = {
    ...previousMetadata,
    gitMode, installMode,
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
  const gitMode = oldMetadata.gitMode ?? configGitMode(legacyInstall) ?? "shared";

  const sddTarget = path.join(layout.root, "sdd");
  const docsTarget = path.join(layout.root, "docs");
  const docMoves = knownDocMoves(absoluteRoot, docsTarget);
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
    normalizeLocalExclusions(absoluteRoot, oldMetadata.excludePatterns ?? []);
  }
  const metadata = writeMigratedMetadata(layout, oldMetadata, {
    gitMode,
    installMode: oldMetadata.installMode ?? "adopt"
  });
  if (!fs.existsSync(layout.config)) fs.writeFileSync(layout.config, `gitMode: ${gitMode}\n`);
  for (const [sourcePath, targetPath] of docMoves) {
    movePath(sourcePath, targetPath);
  }
  movePath(legacySdd, sddTarget);

  return { migrated: true, gitMode, localLauncher: metadata.localLauncher };
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
  const gitMode = oldMetadata.gitMode ?? configGitMode(path.join(legacyRoot, "install.json")) ?? "shared";

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
    normalizeLocalExclusions(absoluteRoot, oldMetadata.excludePatterns ?? []);
  }
  const metadata = writeMigratedMetadata(layout, oldMetadata, {
    gitMode,
    installMode: oldMetadata.installMode ?? "adopt"
  });

  for (const [sourcePath, targetPath] of authoritativeMoves) {
    movePath(sourcePath, targetPath);
  }
  mergeCacheDirectories(path.join(legacyRoot, "cache"), path.join(layout.root, "cache"));

  // Removed last so a failure above never leaves spectra/ half-deleted.
  fs.rmSync(legacyRoot, { recursive: true, force: true });

  return { migrated: true, gitMode, localLauncher: metadata.localLauncher };
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

function preflightLegacyMigration(projectRoot) {
  const root = path.resolve(projectRoot);
  if (isSourceRepository(root)) throw new Error("Refusing migration of a Spectra source repository.");
  const layout = getProjectLayout(root);
  const detected = detectLayout(root);
  const metadataPath = path.join(root, detected === "spectra-dir" ? "spectra/install.json" : ".spectra/install.json");
  const metadata = readMetadata(metadataPath);
  const gitMode = metadata.gitMode ?? configGitMode(metadataPath) ?? "shared";
  if (!["local", "shared"].includes(gitMode)) throw new Error("Invalid migration Git mode.");
  const moves = detected === "root-sdd" ? [[path.join(root, "sdd"), layout.sdd], ...knownDocMoves(root, layout.docs)] :
    detected === "spectra-dir" ? fs.readdirSync(path.join(root, "spectra")).filter(name => !["cache", "install.json"].includes(name)).map(name => [path.join(root, "spectra", name), path.join(layout.root, name)]) : [];
  for (const candidate of [...[".spectra", "spectra", "sdd"].map(name => path.join(root, name)), ...moves.flat()]) {
    let parent = candidate;
    while (parent !== root) {
      if (fs.lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Unsafe migration symlink: ${parent}`);
      parent = path.dirname(parent);
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) listRelativeFiles(candidate);
  }
  preflightMoves(moves);
  let excludePath = null;
  if (gitMode === "local") {
    const result = spawnSync("git", ["-C", root, "rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" });
    if (result.status !== 0) throw new Error("Cannot migrate local Git mode outside a Git worktree.");
    excludePath = path.resolve(root, result.stdout.trim());
    // The Git directory may live outside the project for a linked worktree,
    // but no component below that actual directory may redirect exclusions.
    const gitDirectory = spawnSync("git", ["-C", root, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
    if (gitDirectory.status !== 0) throw new Error("Cannot resolve migration Git directory.");
    const common = path.resolve(root, gitDirectory.stdout.trim());
    let candidate = excludePath;
    while (candidate !== common) {
      if (!candidate.startsWith(common + path.sep)) throw new Error("Unsafe Git exclusion path.");
      if (fs.lstatSync(candidate, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("Unsafe Git exclude symlink.");
      candidate = path.dirname(candidate);
    }
    excludePath = path.join(fs.realpathSync(path.dirname(excludePath)), path.basename(excludePath));
  }
  return { moves, excludePath };
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

  preflightLegacyMigration(absoluteRoot);
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

export { migrateLegacyLayout, needsMigration, preflightLegacyMigration };
