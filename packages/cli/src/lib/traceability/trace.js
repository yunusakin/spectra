import { readIndex } from "../index/cache.js";
import { normalize, rowValue } from "../business/parser.js";
import { readBusinessIndexes } from "../business/repository.js";
import { loadKnowledgeMap } from "../knowledge/map.js";

// Traceability = what is connected to what, derived on demand from the Knowledge Map (rules,
// feature objects, Repo Index records, with stable IDs and signatures) and the module index. Nothing
// here is stored: canonical intent stays in the rule/feature files, and every edge carries a reason.
//
//   RULE --governs--> feature object (canonical)     AC --covers--> FR/NFR (canonical)
//   RULE --affectsModule--> Repo Index module (canonical module name, resolved by tech/modules.md paths)
//   module --testedBy--> Repo Index test target (derived from the Repo Index)
//
// Verification is a separate question (see evidence.js): a path existing proves nothing passed.

const REQUIREMENT_KINDS = new Set(["functional-requirement", "non-functional-requirement"]);
const GOVERNABLE_KINDS = new Set([...REQUIREMENT_KINDS, "acceptance-scenario"]);
const pathOf = (value) => String(value).trim().replace(/^\.\//, "").replace(/\/+$/, "");
const unique = (values) => [...new Set(values)].sort();

function readIndexSafe(projectRoot) {
  try {
    return readIndex(projectRoot);
  } catch {
    return null;
  }
}

function buildTraceability(projectRoot) {
  const { map } = loadKnowledgeMap(projectRoot);
  const references = new Map(map.references.map((reference) => [reference.id, reference]));
  const records = readIndexSafe(projectRoot)?.records ?? [];
  const recordsByPath = new Map();
  for (const record of records) recordsByPath.set(record.path, [...(recordsByPath.get(record.path) ?? []), record]);
  const { moduleRows } = readBusinessIndexes(projectRoot);

  const moduleRecords = (name) => {
    const row = moduleRows.find((candidate) => normalize(rowValue(candidate, "module")) === normalize(name));
    return String(row ? rowValue(row, "paths") : "").split(",").filter(Boolean).flatMap((value) => recordsByPath.get(pathOf(value)) ?? []).filter((record) => record.kind === "module");
  };

  const edges = new Map();
  const unresolved = [];
  const add = (edge) => edges.set(`${edge.type}\t${edge.from}\t${edge.to}`, edge);

  for (const reference of map.references) {
    if (reference.kind === "business-rule") {
      for (const target of reference.relationships?.governs ?? []) {
        const object = references.get(target);
        if (object && GOVERNABLE_KINDS.has(object.kind)) add({ type: "governs", from: reference.id, to: target, provenance: "canonical", reason: `Governs line of ${reference.id}` });
        else unresolved.push({ type: "governs", from: reference.id, target, reason: "target is not a requirement or acceptance scenario" });
      }
      for (const name of reference.relationships?.affectedModules ?? []) {
        const found = moduleRecords(name);
        if (found.length === 0) unresolved.push({ type: "affectsModule", from: reference.id, target: name, reason: "module name does not resolve to a Repo Index module" });
        for (const record of found) add({ type: "affectsModule", from: reference.id, to: record.id, provenance: "canonical", reason: `Affected Modules '${name}' resolved through tech/modules.md paths` });
      }
    } else if (reference.kind === "acceptance-scenario") {
      const feature = reference.id.slice(0, reference.id.indexOf("#"));
      for (const cover of reference.relationships?.covers ?? []) {
        const target = `${feature}#${cover}`;
        if (REQUIREMENT_KINDS.has(references.get(target)?.kind)) add({ type: "covers", from: reference.id, to: target, provenance: "canonical", reason: `${reference.id} covers ${target}` });
      }
    }
  }
  for (const record of records.filter((candidate) => candidate.kind === "module")) {
    for (const test of (recordsByPath.get(record.path) ?? []).filter((candidate) => candidate.kind === "test-target")) {
      add({ type: "testedBy", from: record.id, to: test.id, provenance: "derived", reason: "Repo Index: test target at the module path" });
    }
    for (const test of record.relationships?.testedBy ?? []) {
      if (references.has(test)) add({ type: "testedBy", from: record.id, to: test, provenance: "derived", reason: "Repo Index testedBy relationship" });
    }
  }

  const sorted = [...edges.values()].sort((a, b) => (a.from + a.type + a.to < b.from + b.type + b.to ? -1 : 1));
  const used = unique([...sorted.flatMap((edge) => [edge.from, edge.to]), ...(map.byKind["test-target"] ?? [])]);
  const subjects = map.references.filter((reference) => reference.kind === "business-rule" || GOVERNABLE_KINDS.has(reference.kind));
  return {
    subjects: Object.fromEntries(subjects.map((reference) => [reference.id, { kind: reference.kind, status: reference.status }])),
    edges: sorted,
    unresolved: unresolved.sort((a, b) => (a.from + a.target < b.from + b.target ? -1 : 1)),
    signatures: Object.fromEntries(unique([...used, ...Object.keys(Object.fromEntries(subjects.map((reference) => [reference.id, 1])))]).map((id) => [id, references.get(id)?.signature ?? null]))
  };
}

// Edges indexed once per trace (not per subject): lookups by type+source, each rule's requirements,
// and the reverse requirement -> active rules index. Only active rules confer governance.
const indexes = new WeakMap();
function indexOf(trace) {
  let index = indexes.get(trace);
  if (index) return index;
  const bySource = new Map();
  const byTypeSource = new Map();
  const push = (map, key, value) => (map.get(key) ?? map.set(key, []).get(key)).push(value);
  for (const edge of trace.edges) {
    push(byTypeSource, `${edge.type}\t${edge.from}`, edge.to);
    push(bySource, edge.from, edge);
  }
  const from = (type, source) => byTypeSource.get(`${type}\t${source}`) ?? [];
  const requirementsOfRule = (rule) => unique(from("governs", rule).flatMap((target) => (REQUIREMENT_KINDS.has(trace.subjects[target]?.kind) ? [target] : from("covers", target))));
  const governingRules = new Map();
  for (const id of Object.keys(trace.subjects)) {
    if (trace.subjects[id].kind !== "business-rule" || trace.subjects[id].status !== "active") continue;
    for (const requirement of requirementsOfRule(id)) push(governingRules, requirement, id);
  }
  index = { from, bySource, requirementsOfRule, governing: (requirements) => unique(requirements.flatMap((requirement) => governingRules.get(requirement) ?? [])) };
  indexes.set(trace, index);
  return index;
}

// One subject's bounded chain: rule -> requirement -> module -> test target (each hop one lookup,
// AC `covers` followed one hop). Missing hops are listed, never omitted.
function traceSubject(trace, id) {
  const { from, bySource, requirementsOfRule, governing } = indexOf(trace);
  const kind = trace.subjects[id]?.kind ?? null;
  const requirements = kind === "business-rule" ? requirementsOfRule(id) : kind === "acceptance-scenario" ? from("covers", id) : kind ? [id] : [];
  const involved = kind === "business-rule" ? [id] : governing(requirements);
  const modules = unique(involved.flatMap((rule) => from("affectsModule", rule)));
  const testsOf = (module) => from("testedBy", module);
  const paths = involved.flatMap((rule) => requirementsOfRule(rule).filter((requirement) => kind === "business-rule" || requirements.includes(requirement)).flatMap((requirement) => from("affectsModule", rule).flatMap((module) => testsOf(module).map((testTarget) => ({ rule, requirement, module, testTarget })))));
  const missing = [];
  if (kind === "business-rule" ? requirements.length === 0 : involved.length === 0) missing.push(kind === "business-rule" ? "requirement" : "rule");
  if (modules.length === 0) missing.push("module");
  if (modules.every((module) => testsOf(module).length === 0)) missing.push("test-target");
  return {
    id,
    kind,
    requirements,
    governedBy: kind === "business-rule" ? [] : involved,
    modules: modules.map((module) => ({ id: module, via: involved.filter((rule) => from("affectsModule", rule).includes(module)) })),
    testTargets: unique(modules.flatMap(testsOf)).map((target) => ({ id: target, module: modules.find((module) => testsOf(module).includes(target)) })),
    paths: [...new Map(paths.map((path) => [JSON.stringify(path), path])).values()].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)),
    missing,
    complete: missing.length === 0 && paths.length > 0,
    edges: unique([id, ...involved, ...requirements, ...modules]).flatMap((source) => bySource.get(source) ?? [])
  };
}

export { buildTraceability, traceSubject };
