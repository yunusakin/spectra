import fs from "node:fs";
import path from "node:path";
import { findSpectraRoot } from "../runtime.js";
import { normalize, readMarkdownTableContent } from "./parser.js";

function readMarkdownTable(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return readMarkdownTableContent(fs.readFileSync(filePath, "utf8"));
}

function getContextRoot(projectRoot) {
  return path.join(projectRoot, "spectra");
}

function getBusinessPaths(projectRoot) {
  const root = getContextRoot(projectRoot);
  const memoryRoot = path.join(root, "sdd", "memory-bank");
  return {
    root,
    memoryRoot,
    businessRoot: path.join(memoryRoot, "business"),
    businessIndexPath: path.join(memoryRoot, "business", "INDEX.md"),
    moduleIndexPath: path.join(memoryRoot, "tech", "modules.md")
  };
}

function requireProjectRoot(cwd) {
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }
  return projectRoot;
}

function resolveBusinessPath(businessRoot, relativePath) {
  const resolved = path.resolve(businessRoot, String(relativePath).replace(/^business\//, ""));
  if (resolved === businessRoot || !resolved.startsWith(`${businessRoot}${path.sep}`)) {
    throw new Error(`Business index references a path outside business memory: ${relativePath}`);
  }
  return resolved;
}

function ruleFile(projectRoot, domain, status) {
  return path.join(projectRoot, "spectra", "sdd", "memory-bank", "business", normalize(domain), status === "active" ? "rules.md" : "unresolved.md");
}

function readBusinessIndexes(projectRoot) {
  const paths = getBusinessPaths(projectRoot);
  return {
    ...paths,
    domainRows: readMarkdownTable(paths.businessIndexPath),
    moduleRows: readMarkdownTable(paths.moduleIndexPath)
  };
}

export {
  getBusinessPaths,
  getContextRoot,
  readBusinessIndexes,
  readMarkdownTable,
  requireProjectRoot,
  resolveBusinessPath,
  ruleFile
};
