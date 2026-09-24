import fs from "node:fs";
import path from "node:path";
import { getActiveRoot, getCacheRoot } from "../project-layout.js";

function isDataRoot(repoRoot) {
  return fs.existsSync(path.join(repoRoot, "install.json")) && fs.existsSync(path.join(repoRoot, "sdd", "system", "manifest.env"));
}

const getContextRoot = getActiveRoot;

function getCacheDir(repoRoot) {
  if (isDataRoot(repoRoot)) {
    return path.join(repoRoot, "cache", "context");
  }
  return path.join(getCacheRoot(repoRoot), "context");
}

export { getCacheDir, getContextRoot, isDataRoot };
