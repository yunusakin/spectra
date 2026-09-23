import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ensureDirectory } from "../runtime.js";

function toPosix(value) {
  return value.split(path.sep).join("/");
}


function slugify(value) {
  return String(value ?? "project-core")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "project-core";
}

function writeYamlContract(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(
    filePath,
    YAML.stringify(payload, {
      indent: 2,
      lineWidth: 0,
      defaultStringType: "PLAIN"
    })
  );
}

function readYamlContract(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return YAML.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid YAML in ${filePath}: ${error.message}`);
  }
}

function writeJsonContract(filePath, payload) {
  writeYamlContract(filePath, payload);
}

function readJsonContract(filePath, fallback = null) {
  return readYamlContract(filePath, fallback);
}

function readMarkdown(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function hasRealMarkdownContent(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return readMarkdown(filePath)
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith(">") &&
        !/^[-*]?\s*<[^>]+>$/.test(line) &&
        !/^`?<[^>]+>`?$/.test(line) &&
        !/filled by|filled before/i.test(line)
    );
}

function ensureFile(filePath, content, { overwrite = false } = {}) {
  if (!overwrite && fs.existsSync(filePath)) {
    return;
  }

  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}


export { ensureFile, hasRealMarkdownContent, readJsonContract, readMarkdown, readYamlContract, slugify, toPosix, writeJsonContract, writeYamlContract };
