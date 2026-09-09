import fs from "node:fs";
import path from "node:path";
import { createRecord, evidenceEntry } from "../model.js";
import { toPosixRelative, readTextFile } from "../fs-walk.js";

const ECOSYSTEM = "gradle";

function findSettingsFile(repoRoot) {
  for (const name of ["settings.gradle.kts", "settings.gradle"]) {
    const candidate = path.join(repoRoot, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function detect(repoRoot) {
  return Boolean(findSettingsFile(repoRoot)) || fs.existsSync(path.join(repoRoot, "build.gradle")) || fs.existsSync(path.join(repoRoot, "build.gradle.kts"));
}

// Heuristic extraction (no full Groovy/Kotlin-DSL grammar): scans for
// include(...) / include "..." statements and pulls quoted project paths.
function extractIncludedProjectPaths(text) {
  const paths = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (!/^\s*include(\(|\s)/.test(line)) continue;
    let current = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"' || ch === "'") {
        if (inQuote) {
          if (current) paths.push(current);
          current = "";
        }
        inQuote = !inQuote;
        continue;
      }
      if (inQuote) current += ch;
    }
  }
  return paths;
}

function gradlePathToDir(gradlePath) {
  return gradlePath.replace(/^:/, "").split(":").join("/");
}

function scanGradle(ctx) {
  const { repoRoot, touch } = ctx;
  const settingsFile = findSettingsFile(repoRoot);
  if (!settingsFile) {
    return [];
  }
  touch(settingsFile);
  const relSettings = toPosixRelative(repoRoot, settingsFile);
  const included = extractIncludedProjectPaths(readTextFile(settingsFile));
  const records = [];

  const rootBuildFile = ["build.gradle.kts", "build.gradle"]
    .map((name) => path.join(repoRoot, name))
    .find((p) => fs.existsSync(p));

  records.push(
    createRecord({
      kind: "module",
      name: path.basename(repoRoot),
      path: ".",
      ecosystem: ECOSYSTEM,
      confidence: "medium",
      status: "candidate",
      evidence: [evidenceEntry(relSettings, "include"), ...(rootBuildFile ? [evidenceEntry(toPosixRelative(repoRoot, rootBuildFile))] : [])],
      attributes: { isRoot: true, includedProjects: included }
    })
  );

  for (const gradlePath of included) {
    const dir = gradlePathToDir(gradlePath);
    const absDir = path.join(repoRoot, dir);
    const buildFile = ["build.gradle.kts", "build.gradle"].map((name) => path.join(absDir, name)).find((p) => fs.existsSync(p));

    const evidence = [evidenceEntry(relSettings, "include")];
    if (buildFile) {
      touch(buildFile);
      evidence.push(evidenceEntry(toPosixRelative(repoRoot, buildFile)));
    }

    records.push(
      createRecord({
        kind: "module",
        name: gradlePath,
        path: dir,
        ecosystem: ECOSYSTEM,
        confidence: buildFile ? "medium" : "low",
        status: "candidate",
        evidence,
        attributes: { gradlePath }
      })
    );

    if (buildFile && /test/i.test(readTextFile(buildFile))) {
      records.push(
        createRecord({
          kind: "test-target",
          name: `${gradlePath}:test`,
          path: dir,
          ecosystem: ECOSYSTEM,
          confidence: "low",
          status: "candidate",
          evidence: [evidenceEntry(toPosixRelative(repoRoot, buildFile))]
        })
      );
    }
  }

  return records;
}

export { scanGradle, detect as detectGradle };
