import crypto from "node:crypto";
import { createRecord, evidenceEntry } from "./model.js";
import { statSignature } from "./fs-walk.js";
import { scanNode, detectNode } from "./scanners/node.js";
import { scanGo, detectGo } from "./scanners/go.js";
import { scanMaven, detectMaven } from "./scanners/maven.js";
import { scanGradle, detectGradle } from "./scanners/gradle.js";
import { scanDotnet, detectDotnet } from "./scanners/dotnet.js";
import { scanPython, detectPython } from "./scanners/python.js";

const SCANNERS = [
  { ecosystem: "maven", detect: detectMaven, scan: scanMaven },
  { ecosystem: "gradle", detect: detectGradle, scan: scanGradle },
  { ecosystem: "node", detect: detectNode, scan: scanNode },
  { ecosystem: "go", detect: detectGo, scan: scanGo },
  { ecosystem: "dotnet", detect: detectDotnet, scan: scanDotnet },
  { ecosystem: "python", detect: detectPython, scan: scanPython }
];

const INDEX_SCHEMA_VERSION = 1;

function sortRecords(records) {
  return [...records].sort((a, b) => a.id.localeCompare(b.id));
}

function computeSignature(touchedFiles) {
  const entries = [...touchedFiles].sort();
  const signatures = entries.map((absPath) => {
    try {
      return statSignature(absPath);
    } catch {
      return `${absPath}:missing`;
    }
  });
  const hash = crypto.createHash("sha1");
  hash.update(signatures.join("\n"));
  return { hash: hash.digest("hex"), fileCount: entries.length };
}

function buildRepoIndex(repoRoot) {
  const touched = new Set();
  const ctx = {
    repoRoot,
    touch: (absPath) => touched.add(absPath)
  };

  const ecosystems = [];
  const records = [];

  for (const scanner of SCANNERS) {
    if (!scanner.detect(repoRoot)) {
      continue;
    }
    ecosystems.push(scanner.ecosystem);
    records.push(...scanner.scan(ctx));
  }

  const signature = computeSignature(touched);

  const projectRecord = createRecord({
    kind: "project",
    name: "repository",
    path: ".",
    ecosystem: ecosystems.length > 0 ? ecosystems.join("+") : "unknown",
    confidence: ecosystems.length > 0 ? "high" : "low",
    status: ecosystems.length > 0 ? "confirmed" : "candidate",
    evidence:
      ecosystems.length > 0
        ? ecosystems.map((eco) => evidenceEntry(`ecosystem:${eco}`))
        : [evidenceEntry("no recognized ecosystem manifest found")],
    attributes: { ecosystems }
  });

  const allRecords = sortRecords([projectRecord, ...records]);

  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ecosystems: ecosystems.sort(),
    signature,
    stats: buildStats(allRecords),
    records: allRecords
  };
}

function buildStats(records) {
  const byKind = {};
  const byConfidence = { high: 0, medium: 0, low: 0 };
  const byStatus = { confirmed: 0, candidate: 0 };
  for (const record of records) {
    byKind[record.kind] = (byKind[record.kind] ?? 0) + 1;
    byConfidence[record.confidence] += 1;
    byStatus[record.status] += 1;
  }
  return { total: records.length, byKind, byConfidence, byStatus };
}

export { buildRepoIndex, INDEX_SCHEMA_VERSION };
