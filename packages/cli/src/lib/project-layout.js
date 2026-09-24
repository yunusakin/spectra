import fs from "node:fs";
import path from "node:path";

// The canonical Spectra project root is <project>/.spectra (3.0.9+).
// Older installs used either <project>/spectra (3.0.8) or a root-level
// sdd/ directory with a .spectra/ data directory (pre-3.0). Layout
// detection is manifest-based: the data root is whichever directory
// contains sdd/system/manifest.env, because .spectra/install.json alone
// cannot distinguish the canonical root from a pre-3.0 data directory.
const CANONICAL_DIR = ".spectra";
const LEGACY_SPECTRA_DIR = "spectra";

const LAYOUT_DIRS = {
  canonical: CANONICAL_DIR,
  "spectra-dir": LEGACY_SPECTRA_DIR,
  "root-sdd": ""
};

function getProjectLayout(projectRoot) {
  const root = path.join(path.resolve(projectRoot), CANONICAL_DIR);
  return {
    root,
    bin: path.join(root, "bin"),
    cli: path.join(root, "cli"),
    docs: path.join(root, "docs"),
    sdd: path.join(root, "sdd"),
    config: path.join(root, "config.yaml"),
    installMetadata: path.join(root, "install.json"),
    launcher: path.join(root, "bin", "spectra")
  };
}

// Returns "canonical" | "spectra-dir" | "root-sdd" | null.
function detectLayout(projectRoot) {
  const root = path.resolve(projectRoot);
  const probes = [
    ["canonical", path.join(root, CANONICAL_DIR, "sdd", "system", "manifest.env")],
    ["spectra-dir", path.join(root, LEGACY_SPECTRA_DIR, "sdd", "system", "manifest.env")],
    ["root-sdd", path.join(root, "sdd", "system", "manifest.env")]
  ];
  for (const [layoutName, probePath] of probes) {
    if (fs.existsSync(probePath)) {
      return layoutName;
    }
  }
  return null;
}

// The directory that holds sdd/ (and, for non-root layouts, bin/, docs/,
// install.json, cache/). For pre-3.0 root-sdd installs this is the
// project root itself.
function getDataRoot(projectRoot) {
  const layout = detectLayout(projectRoot);
  const root = path.resolve(projectRoot);
  if (!layout) {
    return path.join(root, CANONICAL_DIR);
  }
  return layout === "root-sdd" ? root : path.join(root, LAYOUT_DIRS[layout]);
}

function getSddRoot(projectRoot) {
  const layout = detectLayout(projectRoot);
  if (!layout) {
    return path.join(path.resolve(projectRoot), CANONICAL_DIR, "sdd");
  }
  return path.join(getDataRoot(projectRoot), "sdd");
}

// Pre-3.0 projects keep their derived cache in the .spectra/ data
// directory while sdd/ lives at the project root, so cache location is
// resolved independently of the sdd root.
function getCacheRoot(projectRoot) {
  const layout = detectLayout(projectRoot);
  const root = path.resolve(projectRoot);
  if (layout === "spectra-dir") {
    return path.join(root, LEGACY_SPECTRA_DIR, "cache");
  }
  return path.join(root, CANONICAL_DIR, "cache");
}

// Ordered candidates: canonical (.spectra/install.json — also the
// pre-3.0 data directory path), then the 3.0.8 spectra/ install file.
function getInstallMetadataPaths(projectRoot) {
  const root = path.resolve(projectRoot);
  return [
    path.join(root, CANONICAL_DIR, "install.json"),
    path.join(root, LEGACY_SPECTRA_DIR, "install.json")
  ];
}

// True when projectRoot holds a Spectra install in any supported layout.
function hasSpectraInstall(projectRoot) {
  return detectLayout(projectRoot) !== null;
}

// Walks up from startDir to the project root of a Spectra install, or null.
function findProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const layout = detectLayout(current);

    if (layout) {
      // A root-sdd hit inside a directory that also carries install.json
      // means `current` is itself a data directory (.spectra/ or spectra/);
      // the project root is its parent.
      const looksLikeDataDir = layout === "root-sdd" && fs.existsSync(path.join(current, "install.json"));
      if (looksLikeDataDir && path.dirname(current) !== current) {
        return path.dirname(current);
      }
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

// The directory whose sdd/ and cache/ a project reads from, and the working
// directory of runtime shell scripts: the data root for canonical and 3.0.8
// installs, the project root for pre-3.0 root-sdd installs and before install.
function getActiveRoot(projectRoot) {
  return hasSpectraInstall(projectRoot) ? path.dirname(getSddRoot(projectRoot)) : path.resolve(projectRoot);
}

export {
  detectLayout,
  findProjectRoot,
  getActiveRoot,
  hasSpectraInstall,
  getCacheRoot,
  getDataRoot,
  getInstallMetadataPaths,
  getProjectLayout,
  getSddRoot
};
