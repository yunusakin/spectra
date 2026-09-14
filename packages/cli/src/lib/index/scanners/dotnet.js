import fs from "node:fs";
import path from "node:path";
import { createRecord, evidenceEntry, makeRecordId } from "../model.js";
import { toPosixRelative, readTextFile } from "../fs-walk.js";
import { parseXml, findChildren, childText } from "../xml.js";

const ECOSYSTEM = "dotnet";

function findSlnFiles(repoRoot) {
  let entries;
  try {
    entries = fs.readdirSync(repoRoot);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith(".sln")).map((name) => path.join(repoRoot, name));
}

// The .sln format is a structured, line-oriented text format:
//   Project("{TYPE-GUID}") = "Name", "Relative\Path.csproj", "{GUID}"
// We split on the first "=" and then the quoted fields — a small
// hand-rolled parser rather than a general regex over the whole file.
function parseSlnProjectLines(text) {
  const projects = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("Project(")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const rhs = line.slice(eqIndex + 1);
    const parts = rhs.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length >= 2 && parts[1].toLowerCase().endsWith(".csproj")) {
      projects.push({ name: parts[0], relativePath: parts[1].split("\\").join("/") });
    }
  }
  return projects;
}

function scanCsproj(ctx, csprojPath, name) {
  const { repoRoot, touch } = ctx;
  touch(csprojPath);
  const relCsproj = toPosixRelative(repoRoot, csprojPath);
  const relDir = toPosixRelative(repoRoot, path.dirname(csprojPath)) || ".";
  const doc = parseXml(readTextFile(csprojPath));
  const propertyGroups = findChildren(doc, "PropertyGroup");
  const targetFramework = propertyGroups.map((g) => childText(g, "TargetFramework") ?? childText(g, "TargetFrameworks")).find(Boolean);
  const outputType = propertyGroups.map((g) => childText(g, "OutputType")).find(Boolean) ?? "Library";

  const packageRefs = findChildren(doc, "ItemGroup").flatMap((g) => findChildren(g, "PackageReference"));
  const projectRefs = findChildren(doc, "ItemGroup").flatMap((g) => findChildren(g, "ProjectReference"));
  const isTestProject = packageRefs.some((p) => /Microsoft\.NET\.Test\.Sdk|xunit|nunit|MSTest/i.test(p.attrs.Include ?? ""));

  const moduleName = name ?? path.basename(csprojPath, ".csproj");
  const records = [];

  records.push(
    createRecord({
      kind: "module",
      name: moduleName,
      path: relDir,
      ecosystem: ECOSYSTEM,
      confidence: "high",
      status: "confirmed",
      evidence: [evidenceEntry(relCsproj)],
      attributes: { targetFramework, outputType, isTestProject },
      relationships: {
        dependsOn: projectRefs
          .map((ref) => ref.attrs.Include)
          .filter(Boolean)
          .map((rel) => {
            const refDir = toPosixRelative(repoRoot, path.resolve(path.dirname(csprojPath), rel.split("\\").join("/")));
            return makeRecordId(ECOSYSTEM, "module", path.posix.dirname(refDir));
          })
      }
    })
  );

  if (isTestProject) {
    records.push(
      createRecord({
        kind: "test-target",
        name: `${moduleName}:test`,
        path: relDir,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: [evidenceEntry(relCsproj, "PackageReference")]
      })
    );
  }

  if (outputType === "Exe" || outputType === "WinExe") {
    records.push(
      createRecord({
        kind: "entrypoint",
        name: `${moduleName}:entry`,
        path: relDir,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: [evidenceEntry(relCsproj, "PropertyGroup.OutputType")]
      })
    );
  }

  for (const pkg of packageRefs) {
    const pkgName = pkg.attrs.Include;
    if (!pkgName) continue;
    records.push(
      createRecord({
        kind: "dependency",
        name: pkgName,
        path: null,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: [evidenceEntry(relCsproj, "PackageReference")],
        attributes: { version: pkg.attrs.Version }
      })
    );
  }

  if (packageRefs.some((p) => /Microsoft\.AspNetCore/i.test(p.attrs.Include ?? ""))) {
    records.push(
      createRecord({
        kind: "runtime",
        name: "ASP.NET Core",
        path: relDir,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: [evidenceEntry(relCsproj, "PackageReference")],
        attributes: { framework: "ASP.NET Core" }
      })
    );
  }

  return records;
}

function scanDotnet(ctx) {
  const { repoRoot, touch } = ctx;
  const slnFiles = findSlnFiles(repoRoot);
  const records = [];
  const seenCsproj = new Set();

  for (const slnPath of slnFiles) {
    touch(slnPath);
    const projects = parseSlnProjectLines(readTextFile(slnPath));
    for (const project of projects) {
      const csprojPath = path.resolve(repoRoot, project.relativePath);
      if (!fs.existsSync(csprojPath)) continue;
      seenCsproj.add(csprojPath);
      records.push(...scanCsproj(ctx, csprojPath, project.name));
    }
  }

  if (slnFiles.length === 0) {
    // No .sln present: fall back to discovering *.csproj directly.
    const csprojDirect = findCsprojFiles(repoRoot);
    for (const csprojPath of csprojDirect) {
      if (seenCsproj.has(csprojPath)) continue;
      records.push(...scanCsproj(ctx, csprojPath, undefined));
    }
  }

  return records;
}

function findCsprojFiles(repoRoot) {
  const results = [];
  function walk(dir, depth) {
    if (depth > 8) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (["bin", "obj", "node_modules", ".git"].includes(entry.name)) continue;
        walk(path.join(dir, entry.name), depth + 1);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".csproj")) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  walk(repoRoot, 0);
  return results.sort();
}

function detectDotnet(repoRoot) {
  return findSlnFiles(repoRoot).length > 0 || findCsprojFiles(repoRoot).length > 0;
}

export { scanDotnet, detectDotnet };
