import fs from "node:fs";
import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { getFeatureDirs } from "./feature-bundles.js";
import { hasRealMarkdownContent, writeJsonContract } from "./primitives.js";

function buildAdoptionArtifacts(repoRoot) {
  const sddRoot = getSddRoot(repoRoot);
  const discoveryDir = path.join(sddRoot, "memory-bank", "discovery");
  const summaryPath = path.join(sddRoot, "adoption", "current-state.summary.yaml");
  const gapPath = path.join(sddRoot, "adoption", "gap-analysis.yaml");
  const reviewPath = path.join(sddRoot, "adoption", "review-queue.yaml");

  const discoveryFiles = fs.existsSync(discoveryDir)
    ? fs
        .readdirSync(discoveryDir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => path.join(discoveryDir, name))
    : [];

  const hasTraceability = hasRealMarkdownContent(path.join(sddRoot, "memory-bank", "core", "traceability.md"));
  const hasImplementationBrief = hasRealMarkdownContent(
    path.join(sddRoot, "memory-bank", "core", "implementation-brief.md")
  );
  const featureDirs = getFeatureDirs(repoRoot);
  const items = [
    {
      requirement_id: "ADOPT-SPECS",
      title: "Executable feature bundle exists",
      category: featureDirs.length > 0 ? "matches" : "missing",
      confidence: featureDirs.length > 0 ? 0.95 : 0.99,
      severity: "high",
      evidence: featureDirs.map((featureDir) => path.relative(repoRoot, featureDir))
    },
    {
      requirement_id: "ADOPT-TRACEABILITY",
      title: "Traceability map links requirements to code and tests",
      category: hasTraceability ? "partial" : "missing",
      confidence: hasTraceability ? 0.8 : 0.99,
      severity: "medium",
      evidence: ["sdd/memory-bank/core/traceability.md"]
    },
    {
      requirement_id: "ADOPT-IMPLEMENTATION-BRIEF",
      title: "Implementation brief captures intended work",
      category: hasImplementationBrief ? "partial" : "missing",
      confidence: hasImplementationBrief ? 0.8 : 0.99,
      severity: "medium",
      evidence: ["sdd/memory-bank/core/implementation-brief.md"]
    },
    {
      requirement_id: "ADOPT-DISCOVERY",
      title: "Brownfield discovery artifacts are present",
      category: discoveryFiles.length > 0 ? "partial" : "unknown",
      confidence: discoveryFiles.length > 0 ? 0.75 : 0.4,
      severity: "medium",
      evidence: discoveryFiles.map((filePath) => path.relative(repoRoot, filePath))
    }
  ];

  const summary = items.reduce(
    (accumulator, item) => {
      accumulator[item.category] += 1;
      return accumulator;
    },
    { matches: 0, partial: 0, missing: 0, conflict: 0, unknown: 0 }
  );

  writeJsonContract(summaryPath, {
    apiVersion: "spectra/v2",
    kind: "CurrentStateSummary",
    repo_mode: "brownfield",
    discovery_sources: discoveryFiles.map((filePath) => path.relative(repoRoot, filePath)),
    services: [],
    generated_at: new Date().toISOString()
  });

  writeJsonContract(gapPath, {
    apiVersion: "spectra/v2",
    kind: "GapAnalysis",
    generated_at: new Date().toISOString(),
    summary,
    items
  });

  writeJsonContract(reviewPath, {
    apiVersion: "spectra/v2",
    kind: "ReviewQueue",
    items: items
      .filter((item) => item.category === "unknown" || (item.category === "partial" && item.confidence < 0.8))
      .map((item) => ({
        id: `${item.requirement_id}-review`,
        title: item.title,
        owner: "human",
        blocking: item.severity === "high"
      }))
  });
}


export { buildAdoptionArtifacts };
