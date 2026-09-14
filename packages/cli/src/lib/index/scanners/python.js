import fs from "node:fs";
import path from "node:path";
import { createRecord, evidenceEntry } from "../model.js";
import { toPosixRelative, readTextFile } from "../fs-walk.js";

const ECOSYSTEM = "python";

function detect(repoRoot) {
  return ["pyproject.toml", "requirements.txt", "setup.cfg", "setup.py"].some((name) =>
    fs.existsSync(path.join(repoRoot, name))
  );
}

// Minimal TOML subset reader: top-level "[section]" / "[section.sub]"
// headers and simple `key = "value"` / `key = ["a", "b"]` assignments.
// Not a full TOML parser, but a structured line-based one (not a blob regex).
function parseTomlSubset(text) {
  const sections = {};
  let currentSection = "";
  sections[currentSection] = {};

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      sections[currentSection] = sections[currentSection] ?? {};
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    const rawValue = line.slice(eqIndex + 1).trim();
    sections[currentSection][key] = parseTomlValue(rawValue);
  }
  return sections;
}

function parseTomlValue(rawValue) {
  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    const inner = rawValue.slice(1, -1);
    return inner
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
    return rawValue.slice(1, -1);
  }
  return rawValue;
}

function scanPython(ctx) {
  const { repoRoot, touch } = ctx;
  if (!detect(repoRoot)) {
    return [];
  }

  const records = [];
  const pyprojectPath = path.join(repoRoot, "pyproject.toml");

  let moduleName = path.basename(repoRoot);
  let moduleEvidence = [];
  let moduleConfidence = "low";
  let moduleStatus = "candidate";

  if (fs.existsSync(pyprojectPath)) {
    touch(pyprojectPath);
    const relPath = toPosixRelative(repoRoot, pyprojectPath);
    const sections = parseTomlSubset(readTextFile(pyprojectPath));
    const projectSection = sections.project ?? {};
    if (projectSection.name) {
      moduleName = projectSection.name;
      moduleEvidence.push(evidenceEntry(relPath, "project.name"));
      moduleConfidence = "high";
      moduleStatus = "confirmed";
    } else {
      moduleEvidence.push(evidenceEntry(relPath));
      moduleConfidence = "medium";
      moduleStatus = "candidate";
    }

    const deps = Array.isArray(projectSection.dependencies) ? projectSection.dependencies : [];
    for (const dep of deps) {
      const depName = dep.split(/[<>=!~\s]/)[0];
      if (!depName) continue;
      records.push(
        createRecord({
          kind: "dependency",
          name: depName,
          path: null,
          ecosystem: ECOSYSTEM,
          confidence: "high",
          status: "confirmed",
          evidence: [evidenceEntry(relPath, "project.dependencies")],
          attributes: { spec: dep }
        })
      );
    }

    const scripts = sections["project.scripts"] ?? {};
    for (const [scriptName, target] of Object.entries(scripts)) {
      records.push(
        createRecord({
          kind: "entrypoint",
          name: `${moduleName}:${scriptName}`,
          path: ".",
          ecosystem: ECOSYSTEM,
          confidence: "high",
          status: "confirmed",
          evidence: [evidenceEntry(relPath, `project.scripts.${scriptName}`)],
          attributes: { target }
        })
      );
    }
  } else {
    moduleEvidence.push(evidenceEntry("setup.py or setup.cfg present"));
  }

  const requirementsPath = path.join(repoRoot, "requirements.txt");
  if (fs.existsSync(requirementsPath)) {
    touch(requirementsPath);
    const relReq = toPosixRelative(repoRoot, requirementsPath);
    moduleEvidence.push(evidenceEntry(relReq));
    for (const rawLine of readTextFile(requirementsPath).split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const depName = line.split(/[<>=!~\s]/)[0];
      if (!depName) continue;
      records.push(
        createRecord({
          kind: "dependency",
          name: depName,
          path: null,
          ecosystem: ECOSYSTEM,
          confidence: "high",
          status: "confirmed",
          evidence: [evidenceEntry(relReq)],
          attributes: { spec: line }
        })
      );
    }
  }

  const setupPyPath = path.join(repoRoot, "setup.py");
  if (fs.existsSync(setupPyPath)) {
    touch(setupPyPath);
    moduleEvidence.push(evidenceEntry(toPosixRelative(repoRoot, setupPyPath), "not executed — presence only"));
  }

  records.unshift(
    createRecord({
      kind: "module",
      name: moduleName,
      path: ".",
      ecosystem: ECOSYSTEM,
      confidence: moduleConfidence,
      status: moduleStatus,
      evidence: moduleEvidence.length > 0 ? moduleEvidence : [evidenceEntry("python manifest present")]
    })
  );

  const testsDir = path.join(repoRoot, "tests");
  const hasTestsDir = fs.existsSync(testsDir);
  if (hasTestsDir) {
    records.push(
      createRecord({
        kind: "test-target",
        name: `${moduleName}:test`,
        path: "tests",
        ecosystem: ECOSYSTEM,
        confidence: "medium",
        status: "candidate",
        evidence: [evidenceEntry("tests/")]
      })
    );
  }

  return records;
}

export { scanPython, detect as detectPython };
