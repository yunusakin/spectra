import fs from "node:fs";
import path from "node:path";
import { getCacheRoot } from "../project-layout.js";
import { readIndex, sortKeysDeep } from "../index/cache.js";
import { enumerateBusinessRules, enumerateFeatureObjects, sha256 } from "./address.js";
import { createKnowledgeReference } from "./reference.js";

const KNOWLEDGE_MAP_CONTRACT_VERSION = 1;

function getKnowledgeMapPath(projectRoot) {
  return path.join(getCacheRoot(projectRoot), "knowledge", "knowledge-map.json");
}

// Lightweight pointer to an existing Repo Index record: the record keeps its id,
// and its evidence/attributes stay in the index.
function repoIndexReferences(projectRoot) {
  const index = readIndex(projectRoot);
  return (index?.records ?? []).map((record) => ({
    reference: {
      ...createKnowledgeReference({
        id: record.id,
        kind: record.kind,
        source: "repo-index",
        address: record.id,
        provenance: "repository-discovered",
        status: record.status,
        relationships: Object.fromEntries(Object.entries(record.relationships ?? {}).filter(([, value]) => value.length > 0))
      }),
      confidence: record.confidence
    },
    signature: sha256(JSON.stringify(sortKeysDeep(record)))
  }));
}

function group(references, key) {
  const groups = {};
  for (const reference of references) {
    (groups[reference[key]] ??= []).push(reference.id);
  }
  return groups;
}

// Includes locators: a moved object keeps its object signature but the map must
// not look fresh with a stale `source`.
function computeSourceSignature(references) {
  return sha256(references.map((reference) => `${reference.id}\t${reference.source}\t${reference.signature}`).join("\n"));
}

function buildKnowledgeMap(projectRoot) {
  const entries = [...enumerateBusinessRules(projectRoot), ...enumerateFeatureObjects(projectRoot), ...repoIndexReferences(projectRoot)];
  const references = entries.map(({ reference, signature }) => ({ ...reference, signature })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let i = 1; i < references.length; i += 1) {
    if (references[i].id === references[i - 1].id) throw new Error(`Duplicate knowledge identity: ${references[i].id}`);
  }
  return {
    contractVersion: KNOWLEDGE_MAP_CONTRACT_VERSION,
    sourceSignature: computeSourceSignature(references),
    byKind: group(references, "kind"),
    bySource: group(references, "source"),
    references
  };
}

function writeKnowledgeMap(projectRoot, map) {
  const filePath = getKnowledgeMapPath(projectRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(sortKeysDeep(map), null, 2)}\n`, "utf8");
  return filePath;
}

function readKnowledgeMap(projectRoot) {
  const filePath = getKnowledgeMapPath(projectRoot);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
}

function lookupKnowledgeReference(map, id) {
  return map.references.find((reference) => reference.id === id) ?? null;
}

// Never writes. "stale" also covers an unreadable map or an older contract.
function checkKnowledgeMapFreshness(projectRoot) {
  let cached;
  try {
    cached = readKnowledgeMap(projectRoot);
  } catch {
    return { status: "stale", cached: null, fresh: null };
  }
  if (!cached) return { status: "missing", cached: null, fresh: null };
  const fresh = buildKnowledgeMap(projectRoot);
  const stale = cached.contractVersion !== fresh.contractVersion || cached.sourceSignature !== fresh.sourceSignature;
  return { status: stale ? "stale" : "fresh", cached, fresh };
}

export { buildKnowledgeMap, checkKnowledgeMapFreshness, getKnowledgeMapPath, lookupKnowledgeReference, readKnowledgeMap, writeKnowledgeMap };
