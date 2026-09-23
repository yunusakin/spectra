import fs from "node:fs";
import path from "node:path";
import { detectLayout, getCacheRoot } from "../project-layout.js";

function isDataRoot(repoRoot) {
  return fs.existsSync(path.join(repoRoot, "install.json")) && fs.existsSync(path.join(repoRoot, "sdd", "system", "manifest.env"));
}

// The directory whose sdd/ and cache/ this project reads from: the data
// root for canonical and 3.0.8 installs, the project root for pre-3.0
// root-sdd installs (and not-installed trees).
function getContextRoot(projectRoot) {
  const layout = detectLayout(projectRoot);
  if (layout === "canonical") {
    return path.join(projectRoot, ".spectra");
  }
  if (layout === "spectra-dir") {
    return path.join(projectRoot, "spectra");
  }
  return projectRoot;
}

function getCacheDir(repoRoot) {
  if (isDataRoot(repoRoot)) {
    return path.join(repoRoot, "cache", "context");
  }
  return path.join(getCacheRoot(repoRoot), "context");
}

export { getCacheDir, getContextRoot, isDataRoot };
