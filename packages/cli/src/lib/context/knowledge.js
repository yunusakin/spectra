import { readIndex } from "../index/cache.js";
import { normalize, rowValue } from "../business/parser.js";
import { readBusinessIndexes } from "../business/repository.js";
import { loadKnowledgeMap } from "../knowledge/map.js";
import { readKnowledgeObject } from "../knowledge/address.js";
import { termsOf } from "../knowledge/terms.js";

// Strongest reason wins the ordering; all reasons are kept for explainability.
// 1 explicit > 3 direct relationship > 4 routing > 5 changed file > 6 lexical.
const REASON_RANK = {
  "explicit-reference": 1,
  "feature-relationship": 3,
  "repo-index-evidence": 3,
  "business-rule-match": 4,
  "business-domain-match": 4,
  "module-match": 4,
  "changed-file": 5,
  "feature-match": 6
};
const FEATURE_KINDS = new Set(["functional-requirement", "non-functional-requirement", "acceptance-scenario"]);
const MIN_FEATURE_TERM_OVERLAP = 2;

const pathOf = (value) => String(value).trim().replace(/^\.\//, "").replace(/\/+$/, "");
const overlap = (taskTerms, reference) => (reference.terms ?? []).filter((term) => taskTerms.has(term));

function explicitIds(task, byId) {
  const found = [];
  for (const token of String(task ?? "").match(/[A-Za-z0-9_#:@./-]+/g) ?? []) {
    for (const candidate of new Set([token, token.replace(/[.:/-]+$/, "")])) {
      if (byId.has(candidate)) found.push(candidate);
    }
  }
  return found;
}

function compactRecord(record) {
  const relationships = Object.fromEntries(Object.entries(record.relationships ?? {}).filter(([, value]) => value.length > 0));
  return JSON.stringify({
    id: record.id,
    kind: record.kind,
    path: record.path,
    ecosystem: record.ecosystem,
    status: record.status,
    confidence: record.confidence,
    evidence: record.evidence,
    ...(Object.keys(relationships).length > 0 ? { relationships } : {})
  });
}

// Discovers candidates from the Knowledge Map (no canonical rescans), expands
// one hop only, and retrieves exact content for the selected candidates.
function resolveKnowledgeEntries({ projectRoot, task, route, changedFiles = [] }) {
  const { map, status: mapStatus } = loadKnowledgeMap(projectRoot);
  const byId = new Map(map.references.map((reference) => [reference.id, reference]));
  const index = readIndex(projectRoot);
  const records = new Map((index?.records ?? []).map((record) => [record.id, record]));
  const recordsByPath = new Map();
  for (const record of records.values()) {
    if (!recordsByPath.has(record.path)) recordsByPath.set(record.path, []);
    recordsByPath.get(record.path).push(record);
  }
  const { domainRows, moduleRows } = readBusinessIndexes(projectRoot);
  const taskTerms = new Set(termsOf(task));
  const candidates = new Map();
  const add = (id, reason, via) => {
    if (!byId.has(id)) return;
    const reasons = candidates.get(id) ?? [];
    if (!reasons.some((entry) => entry.reason === reason && entry.via === via)) reasons.push({ reason, via });
    candidates.set(id, reasons);
  };
  const moduleRecords = (moduleName) => {
    const row = moduleRows.find((candidate) => normalize(rowValue(candidate, "module")) === normalize(moduleName));
    return String(row ? rowValue(row, "paths") : "").split(",").filter(Boolean).flatMap((value) => recordsByPath.get(pathOf(value)) ?? []);
  };

  for (const id of explicitIds(task, byId)) add(id, "explicit-reference", id);

  for (const domain of route?.domains ?? []) {
    const row = domainRows.find((candidate) => normalize(rowValue(candidate, "domain")) === domain);
    const ruleIds = [rowValue(row ?? {}, "rules"), rowValue(row ?? {}, "unresolved")]
      .filter(Boolean)
      .flatMap((relativePath) => map.bySource[`sdd/memory-bank/${relativePath.replace(/^sdd\/memory-bank\//, "")}`] ?? []);
    const matching = ruleIds.filter((id) => overlap(taskTerms, byId.get(id)).length > 0);
    for (const id of matching.length > 0 ? matching : ruleIds) {
      if (matching.length > 0) add(id, "business-rule-match", overlap(taskTerms, byId.get(id)).join(","));
      else add(id, "business-domain-match", domain);
    }
  }

  for (const reference of map.references) {
    const matched = FEATURE_KINDS.has(reference.kind) ? overlap(taskTerms, reference) : [];
    if (matched.length >= MIN_FEATURE_TERM_OVERLAP) add(reference.id, "feature-match", matched.join(","));
  }

  // Only modules named by the task or --module; modules reached through a matched
  // domain's related-modules list are too broad (rule affectedModules is exact).
  for (const { name, matchedBy } of route?.moduleMatches ?? []) {
    if (matchedBy !== "explicit-module" && matchedBy !== "module") continue;
    for (const record of moduleRecords(name)) if (record.kind === "module") add(record.id, "module-match", name);
  }

  const modulePaths = [...recordsByPath.keys()].filter((candidate) => candidate !== ".");
  for (const file of changedFiles) {
    const owner = modulePaths.filter((candidate) => file === candidate || file.startsWith(`${candidate}/`)).sort((a, b) => b.length - a.length)[0];
    for (const record of recordsByPath.get(owner) ?? []) if (record.kind === "module") add(record.id, "changed-file", file);
  }

  // One hop from the seeds above; expansions are never expanded again.
  for (const [id] of [...candidates]) {
    const reference = byId.get(id);
    const hash = id.indexOf("#");
    if (reference.kind === "acceptance-scenario") {
      for (const cover of reference.relationships?.covers ?? []) add(`${id.slice(0, hash)}#${cover}`, "feature-relationship", id);
    } else if (FEATURE_KINDS.has(reference.kind)) {
      for (const other of map.byKind["acceptance-scenario"] ?? []) {
        if (other.startsWith(`${id.slice(0, hash)}#`) && byId.get(other).relationships?.covers?.includes(id.slice(hash + 1))) add(other, "feature-relationship", id);
      }
    } else if (reference.kind === "business-rule") {
      for (const name of reference.relationships?.affectedModules ?? []) {
        for (const record of moduleRecords(name)) add(record.id, "repo-index-evidence", id);
      }
    } else if (reference.source === "repo-index" && reference.kind === "module") {
      const record = records.get(id);
      if (!record) continue;
      const tests = [...(recordsByPath.get(record.path) ?? []).filter((candidate) => candidate.kind === "test-target").map((candidate) => candidate.id), ...(record.relationships?.testedBy ?? [])];
      for (const testId of tests) add(testId, "repo-index-evidence", id);
    }
  }

  const rank = (reasons) => Math.min(...reasons.map(({ reason }) => REASON_RANK[reason]));
  const ordered = [...candidates].sort(([idA, a], [idB, b]) => rank(a) - rank(b) || (idA < idB ? -1 : idA > idB ? 1 : 0));

  const entries = [];
  for (const [id, reasons] of ordered) {
    const reference = byId.get(id);
    const content = reference.source === "repo-index" ? (records.has(id) ? compactRecord(records.get(id)) : null) : readKnowledgeObject(projectRoot, reference);
    if (content === null) continue;
    entries.push({
      id,
      knowledgeId: id,
      label: id,
      mode: "object",
      source: "resolved",
      kind: reference.kind,
      path: reference.source,
      address: reference.address,
      provenance: reference.provenance,
      status: reference.status,
      reasons: reasons.sort((a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || (a.via < b.via ? -1 : 1)),
      content,
      exists: true,
      changed: false,
      changedRefs: [],
      estimatedTokens: Math.ceil(content.length / 4)
    });
  }
  return { entries, mapStatus };
}

export { resolveKnowledgeEntries };
