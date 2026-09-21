import fs from "node:fs";
import path from "node:path";
import { createRecord, evidenceEntry } from "../model.js";
import { toPosixRelative, readTextFile, findFilesByExtension } from "../fs-walk.js";

const ECOSYSTEM = "go";

function detect(repoRoot) {
  return fs.existsSync(path.join(repoRoot, "go.mod")) || fs.existsSync(path.join(repoRoot, "go.work"));
}

// Structured line-based reader for go.mod / go.work (the Go module file
// format is line-oriented, not regex-shaped: single directives or
// "keyword (\n ... \n)" blocks).
function parseGoDirectives(text) {
  const result = { module: undefined, go: undefined, require: [], replace: [], use: [] };
  const lines = text.split("\n");
  let blockKeyword = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) continue;

    if (blockKeyword) {
      if (line === ")") {
        blockKeyword = null;
        continue;
      }
      pushDirective(result, blockKeyword, line);
      continue;
    }

    const openBlock = /^(module|go|require|replace|use)\s*\(/.exec(line);
    if (openBlock) {
      blockKeyword = openBlock[1];
      continue;
    }

    const single = /^(module|go|require|replace|use)\s+(.+)$/.exec(line);
    if (single) {
      pushDirective(result, single[1], single[2].trim());
    }
  }
  return result;
}

function pushDirective(result, keyword, value) {
  if (keyword === "module") {
    result.module = value.trim();
  } else if (keyword === "go") {
    result.go = value.trim();
  } else if (keyword === "require") {
    result.require.push(value.trim());
  } else if (keyword === "replace") {
    result.replace.push(value.trim());
  } else if (keyword === "use") {
    result.use.push(value.trim().replace(/^\.\//, ""));
  }
}

function scanGoModule(ctx, dir) {
  const { repoRoot, touch } = ctx;
  const goModPath = path.join(dir, "go.mod");
  if (!fs.existsSync(goModPath)) {
    return [];
  }
  touch(goModPath);
  const directives = parseGoDirectives(readTextFile(goModPath));
  const relDir = toPosixRelative(repoRoot, dir) || ".";
  const relGoMod = toPosixRelative(repoRoot, goModPath);
  const moduleName = directives.module ?? relDir;
  const records = [];

  records.push(
    createRecord({
      kind: "module",
      name: moduleName,
      path: relDir,
      ecosystem: ECOSYSTEM,
      confidence: "high",
      status: "confirmed",
      evidence: [evidenceEntry(relGoMod, "module")],
      attributes: { goVersion: directives.go }
    })
  );

  for (const req of directives.require) {
    const [depName, depVersion] = req.split(/\s+/);
    if (!depName) continue;
    records.push(
      createRecord({
        kind: "dependency",
        name: depName,
        path: null,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: [evidenceEntry(relGoMod, "require")],
        attributes: { version: depVersion }
      })
    );
  }

  const testFiles = findFilesByExtension(dir, [".go"]).filter((f) => f.endsWith("_test.go"));
  if (testFiles.length > 0) {
    records.push(
      createRecord({
        kind: "test-target",
        name: `${moduleName}:test`,
        path: relDir,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: [evidenceEntry(toPosixRelative(repoRoot, testFiles[0]))],
        attributes: { testFileCount: testFiles.length }
      })
    );
  }

  const cmdDir = path.join(dir, "cmd");
  if (fs.existsSync(cmdDir)) {
    for (const entry of fs.readdirSync(cmdDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const cmdPath = path.join(cmdDir, entry.name);
      const goFiles = findFilesByExtension(cmdPath, [".go"], { maxDepth: 1 });
      const mainFile = goFiles.find((f) => readTextFile(f).includes("package main"));
      if (mainFile) {
        records.push(
          createRecord({
            kind: "entrypoint",
            name: `${moduleName}:cmd:${entry.name}`,
            path: toPosixRelative(repoRoot, cmdPath),
            ecosystem: ECOSYSTEM,
            confidence: "high",
            status: "confirmed",
            evidence: [evidenceEntry(toPosixRelative(repoRoot, mainFile), "package main")]
          })
        );
      }
    }
  }

  return records;
}

function scanGo(ctx) {
  const { repoRoot, touch } = ctx;
  if (!detect(repoRoot)) {
    return [];
  }

  const goWorkPath = path.join(repoRoot, "go.work");
  const moduleDirs = new Set();

  if (fs.existsSync(goWorkPath)) {
    touch(goWorkPath);
    const directives = parseGoDirectives(readTextFile(goWorkPath));
    for (const use of directives.use) {
      moduleDirs.add(path.join(repoRoot, use));
    }
  } else if (fs.existsSync(path.join(repoRoot, "go.mod"))) {
    moduleDirs.add(repoRoot);
  }

  const records = [];
  for (const dir of moduleDirs) {
    records.push(...scanGoModule(ctx, dir));
  }
  return records;
}

export { scanGo, detect as detectGo };
