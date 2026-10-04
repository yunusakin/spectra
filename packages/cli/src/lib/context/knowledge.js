import { readIndex } from "../index/cache.js";
import { normalize, rowValue } from "../business/parser.js";
import { readBusinessIndexes } from "../business/repository.js";
import { loadKnowledgeMap } from "../knowledge/map.js";
import { readKnowledgeObject } from "../knowledge/address.js";
import { termsOf } from "../knowledge/terms.js";

// Discrete selection tiers; the strongest reason sets a candidate's priority and
// all reasons are kept for explainability. Priority 0 means required: it is never
// dropped for budget (see selection.js). A Repo Index module reached from a rule
// or a changed file is an anchor (3); its test-target is secondary evidence (4).
const REASON_PRIORITY = {
  "explicit-reference": 0,
  "feature-relationship": 1,
  "business-rule-match": 2,
  "module-match": 3,
  "changed-file": 3,
  "repo-index-evidence": 4,
  "business-domain-match": 5,
  "feature-match": 6
};
const reasonPriority = ({ reason }, kind) => (reason === "repo-index-evidence" && kind === "module" ? 3 : REASON_PRIORITY[reason]);
const FEATURE_KINDS = new Set(["functional-requirement", "non-functional-requirement", "acceptance-scenario"]);
const MIN_FEATURE_TERM_OVERLAP = 2;
const MIN_RULE_TERM_OVERLAP = 2;
const DIRECT_DOMAIN_SIGNALS = new Set(["explicit-domain", "domain", "keyword"]);

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

  const explicit = explicitIds(task, byId);
  const hasExplicitReference = explicit.length > 0;
  for (const id of explicit) add(id, "explicit-reference", id);

  for (const domain of route?.domains ?? []) {
    const row = domainRows.find((candidate) => normalize(rowValue(candidate, "domain")) === domain);
    const ruleIds = [rowValue(row ?? {}, "rules"), rowValue(row ?? {}, "unresolved")]
      .filter(Boolean)
      .flatMap((relativePath) => map.bySource[`sdd/memory-bank/${relativePath.replace(/^sdd\/memory-bank\//, "")}`] ?? []);
    // A single shared term only counts when no rule in the domain shares two (like features,
    // which need two); generic words then cannot ride along with a real match.
    const matched = ruleIds.filter((id) => overlap(taskTerms, byId.get(id)).length > 0);
    const matching = matched.some((id) => overlap(taskTerms, byId.get(id)).length >= MIN_RULE_TERM_OVERLAP)
      ? matched.filter((id) => overlap(taskTerms, byId.get(id)).length >= MIN_RULE_TERM_OVERLAP)
      : matched;
    // Whole-domain fallback needs a direct domain signal (explicit --domain, the domain named in the
    // task, or a configured keyword). A domain reached only through a module's business domains
    // contributes the rules that share a term with the task, never all of them.
    // A task that already names exact objects does not need a guess at the rest of the domain,
    // unless the user asked for the domain itself (--domain).
    const signals = (route.domainMatches ?? []).filter((match) => match.name === domain).map((match) => match.matchedBy);
    const direct = signals.includes("explicit-domain") || (!hasExplicitReference && signals.some((signal) => DIRECT_DOMAIN_SIGNALS.has(signal)));
    for (const id of matching.length > 0 ? matching : direct ? ruleIds : []) {
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

  // Required: explicit references, plus the requirement an explicitly named scenario
  // covers (the scenario cannot be interpreted without it). The reverse direction
  // (requirement -> covering scenario) is evidence only, so it stays optional.
  const required = new Set([...candidates].filter(([, reasons]) => reasons.some(({ reason }) => reason === "explicit-reference")).map(([id]) => id));
  for (const [id, reasons] of candidates) {
    if (reasons.some(({ reason, via }) => reason === "feature-relationship" && required.has(via) && byId.get(via).kind === "acceptance-scenario" && byId.get(id).kind !== "acceptance-scenario")) required.add(id);
  }
  const priorityOf = (id) => (required.has(id) ? 0 : Math.min(...candidates.get(id).map((reason) => reasonPriority(reason, byId.get(id).kind))));
  const ordered = [...candidates];

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
      required: required.has(id),
      priority: priorityOf(id),
      reasons: reasons.sort((a, b) => reasonPriority(a, reference.kind) - reasonPriority(b, reference.kind) || (a.via < b.via ? -1 : 1)),
      content,
      exists: true,
      changed: false,
      changedRefs: [],
      estimatedTokens: Math.ceil(content.length / 4)
    });
  }
  // Source files the map can address rule by rule: only these may be replaced by exact objects.
  const addressableSources = new Set(Object.keys(map.bySource).filter((source) => map.bySource[source].length > 0));
  return { entries, mapStatus, addressableSources };
}

export { resolveKnowledgeEntries };
