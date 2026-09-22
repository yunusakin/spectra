import fs from "node:fs";
import path from "node:path";
import { getCacheRoot } from "../project-layout.js";
import { buildRepoIndex } from "./engine.js";

function getIndexCacheDir(projectRoot) {
  return path.join(getCacheRoot(projectRoot), "index");
}

function getIndexFilePath(projectRoot) {
  return path.join(getIndexCacheDir(projectRoot), "repo-index.json");
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

function writeIndex(projectRoot, index) {
  const dir = getIndexCacheDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = getIndexFilePath(projectRoot);
  const deterministic = sortKeysDeep(index);
  fs.writeFileSync(filePath, `${JSON.stringify(deterministic, null, 2)}\n`, "utf8");
  return filePath;
}

function readIndex(projectRoot) {
  const filePath = getIndexFilePath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Shared by `spectra index --check` and the `repo-index` verify stage: never
// writes, just reports whether a cached index exists and whether a fresh
// rebuild's signature still matches it.
function checkIndexFreshness(projectRoot) {
  const cached = readIndex(projectRoot);
  if (!cached) {
    return { status: "missing", cached: null, fresh: null };
  }
  const fresh = buildRepoIndex(projectRoot);
  const stale = cached.signature.hash !== fresh.signature.hash || cached.ecosystems.join(",") !== fresh.ecosystems.join(",");
  return { status: stale ? "stale" : "fresh", cached, fresh };
}

export { getIndexCacheDir, getIndexFilePath, writeIndex, readIndex, checkIndexFreshness };
