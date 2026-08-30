import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getProjectLayout } from "./project-layout.js";
import { createInstallMetadata, SCHEMA_VERSION } from "./profile.js";
import { copyDirectory, ensureDirectory, getProfileAssetsDir } from "./runtime.js";

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

const LEGACY_EXCLUSIONS = new Set([".spectra/", "/.spectra/", "sdd/", "/sdd/", "docs/", "/docs/"]);

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
  const normalized = current.filter((line) => line !== "" && !LEGACY_EXCLUSIONS.has(line));
  if (!normalized.includes("/spectra/")) {
    normalized.push("/spectra/");
  }
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

function migrateLegacyLayout(projectRoot) {
  const absoluteRoot = path.resolve(projectRoot);
  const layout = getProjectLayout(absoluteRoot);
  const canonicalManifest = path.join(layout.sdd, "system", "manifest.env");
  if (fs.existsSync(layout.installMetadata) && fs.existsSync(canonicalManifest)) {
    return { migrated: false, reason: "canonical" };
  }

  const legacyInstall = path.join(absoluteRoot, ".spectra", "install.json");
  const legacySdd = path.join(absoluteRoot, "sdd");
  if (!fs.existsSync(legacyInstall) && !fs.existsSync(legacySdd)) {
    return { migrated: false, reason: "not-installed" };
  }
  if (fs.existsSync(layout.root)) {
    throw new Error(`Migration conflict: ${layout.root} already exists.`);
  }

  const oldMetadata = fs.existsSync(legacyInstall)
    ? JSON.parse(fs.readFileSync(legacyInstall, "utf8"))
    : {};
  const profile = oldMetadata.profile === "lite" ? "lite" : "full";
  const gitMode = oldMetadata.gitMode ?? "shared";
  const legacySpectra = path.join(absoluteRoot, ".spectra");
  const projectedSddTarget = fs.existsSync(legacySpectra) ? path.join(legacySpectra, "sdd") : layout.sdd;
  const projectedDocsRoot = fs.existsSync(legacySpectra) ? path.join(legacySpectra, "docs") : layout.docs;
  const docMoves = knownDocMoves(absoluteRoot, profile, projectedDocsRoot);
  preflightMoves([
    [legacySdd, projectedSddTarget],
    ...docMoves
  ]);

  if (fs.existsSync(legacySpectra)) {
    movePath(legacySpectra, layout.root);
  } else {
    ensureDirectory(layout.root);
  }
  movePath(legacySdd, layout.sdd);
  for (const [sourcePath, targetPath] of knownDocMoves(absoluteRoot, profile, layout.docs)) {
    movePath(sourcePath, targetPath);
  }
  copyDirectory(path.join(getProfileAssetsDir(profile), "sdd", "memory-bank"), path.join(layout.sdd, "memory-bank"));

  if (gitMode === "local") {
    normalizeLocalExclusions(absoluteRoot);
  }

  const excludePatterns = gitMode === "local"
    ? [...new Set([...(oldMetadata.excludePatterns ?? []).filter((pattern) => !LEGACY_EXCLUSIONS.has(pattern)), "/spectra/"])]
    : oldMetadata.excludePatterns ?? [];
  const metadata = {
    ...oldMetadata,
    ...createInstallMetadata({ profile, gitMode, installMode: oldMetadata.installMode ?? "adopt" }),
    localLauncher: "spectra/bin/spectra",
    excludePatterns
  };
  fs.writeFileSync(layout.installMetadata, JSON.stringify(metadata, null, 2));
  fs.writeFileSync(layout.config, `profile: ${profile}\ngitMode: ${gitMode}\nschemaVersion: ${SCHEMA_VERSION}\n`);

  return { migrated: true, profile, gitMode };
}

export { migrateLegacyLayout };
