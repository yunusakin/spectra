import fs from "node:fs";
import path from "node:path";
import { createRecord, evidenceEntry, makeRecordId } from "../model.js";
import { toPosixRelative, readTextFile, findManifestFiles } from "../fs-walk.js";
import { parseXml, findChild, findChildren, childText } from "../xml.js";

const ECOSYSTEM = "maven";

function detect(repoRoot) {
  return fs.existsSync(path.join(repoRoot, "pom.xml"));
}

function coordinatesOf(pomNode, parentNode) {
  const groupId = childText(pomNode, "groupId") ?? childText(parentNode, "groupId");
  const artifactId = childText(pomNode, "artifactId");
  const version = childText(pomNode, "version") ?? childText(parentNode, "version");
  return { groupId, artifactId, version };
}

function scanMaven(ctx) {
  const { repoRoot, touch } = ctx;
  if (!detect(repoRoot)) {
    return [];
  }

  const pomFiles = findManifestFiles(repoRoot, ["pom.xml"]);
  const records = [];
  const moduleIdByDir = new Map();
  const childDirsByDir = new Map();

  const parsed = pomFiles.map((pomPath) => {
    touch(pomPath);
    const dir = path.dirname(pomPath);
    const relDir = toPosixRelative(repoRoot, dir) || ".";
    const relPom = toPosixRelative(repoRoot, pomPath);
    const doc = parseXml(readTextFile(pomPath));
    const parentNode = findChild(doc, "parent");
    const coords = coordinatesOf(doc, parentNode);
    const packaging = childText(doc, "packaging") ?? "jar";
    const modulesNode = findChild(doc, "modules");
    const childModules = modulesNode ? findChildren(modulesNode, "module").map((m) => m.text.trim()) : [];
    return { pomPath, dir, relDir, relPom, doc, parentNode, coords, packaging, childModules };
  });

  for (const entry of parsed) {
    const moduleId = makeRecordId(ECOSYSTEM, "module", entry.relDir);
    moduleIdByDir.set(entry.relDir, moduleId);
    childDirsByDir.set(
      entry.relDir,
      entry.childModules.map((rel) => path.posix.normalize(path.posix.join(entry.relDir, rel)))
    );
  }

  for (const entry of parsed) {
    const name = entry.coords.artifactId ?? path.basename(entry.dir);
    const buildNode = findChild(entry.doc, "build");
    const sourceDirOverride = childText(buildNode, "sourceDirectory");
    const testSourceDirOverride = childText(buildNode, "testSourceDirectory");

    const childIds = (childDirsByDir.get(entry.relDir) ?? [])
      .map((childRelDir) => makeRecordId(ECOSYSTEM, "module", childRelDir))
      .filter(Boolean);

    records.push(
      createRecord({
        kind: "module",
        name,
        path: entry.relDir,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: [evidenceEntry(entry.relPom, "artifactId")],
        attributes: {
          groupId: entry.coords.groupId,
          artifactId: entry.coords.artifactId,
          version: entry.coords.version,
          packaging: entry.packaging,
          isParent: entry.childModules.length > 0,
          parent: entry.parentNode
            ? {
                groupId: childText(entry.parentNode, "groupId"),
                artifactId: childText(entry.parentNode, "artifactId"),
                version: childText(entry.parentNode, "version")
              }
            : null,
          sourceRoots: {
            main: {
              path: sourceDirOverride ?? path.posix.join(entry.relDir, "src/main/java"),
              confidence: sourceDirOverride ? "high" : "medium",
              status: sourceDirOverride ? "confirmed" : "candidate"
            },
            test: {
              path: testSourceDirOverride ?? path.posix.join(entry.relDir, "src/test/java"),
              confidence: testSourceDirOverride ? "high" : "medium",
              status: testSourceDirOverride ? "confirmed" : "candidate"
            }
          }
        },
        relationships: { dependsOn: childIds }
      })
    );

    if (fs.existsSync(path.join(repoRoot, testSourceDirOverride ?? path.join(entry.relDir, "src/test/java")))) {
      records.push(
        createRecord({
          kind: "test-target",
          name: `${name}:test`,
          path: entry.relDir,
          ecosystem: ECOSYSTEM,
          confidence: testSourceDirOverride ? "high" : "medium",
          status: testSourceDirOverride ? "confirmed" : "candidate",
          evidence: [
            testSourceDirOverride
              ? evidenceEntry(entry.relPom, "build.testSourceDirectory")
              : evidenceEntry(path.posix.join(entry.relDir, "src/test/java"))
          ]
        })
      );
    }

    const dependenciesNode = findChild(entry.doc, "dependencies");
    for (const dep of findChildren(dependenciesNode, "dependency")) {
      const depGroup = childText(dep, "groupId");
      const depArtifact = childText(dep, "artifactId");
      if (!depGroup || !depArtifact) continue;
      records.push(
        createRecord({
          kind: "dependency",
          name: `${depGroup}:${depArtifact}`,
          path: null,
          ecosystem: ECOSYSTEM,
          confidence: "high",
          status: "confirmed",
          evidence: [evidenceEntry(entry.relPom, "dependencies")],
          attributes: { version: childText(dep, "version"), scope: childText(dep, "scope") ?? "compile" }
        })
      );
    }

    const pluginsNode = findChild(buildNode, "plugins");
    for (const plugin of findChildren(pluginsNode, "plugin")) {
      const artifactId = childText(plugin, "artifactId");
      if (artifactId === "spring-boot-maven-plugin") {
        records.push(
          createRecord({
            kind: "runtime",
            name: "Spring Boot",
            path: entry.relDir,
            ecosystem: ECOSYSTEM,
            confidence: "high",
            status: "confirmed",
            evidence: [evidenceEntry(entry.relPom, "build.plugins")],
            attributes: { framework: "Spring Boot" }
          })
        );
      }
    }
  }

  return records;
}

export { scanMaven, detect as detectMaven };
