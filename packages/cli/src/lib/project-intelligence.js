import { checkIndexFreshness, readIndex } from "./index/cache.js";
import { buildTraceability, traceSubject } from "./traceability/trace.js";
import { concludeVerification, readVerificationEvidence } from "./traceability/evidence.js";
import { changedFileImpact, evaluateGate } from "./traceability/gates.js";

// Read-only Project Intelligence queries: a deterministic projection over the traceability graph
// (Knowledge Map + Repo Index), the verification conclusions and the stage gates. Nothing here stores,
// runs or approves anything, and every verdict comes from the existing APIs (concludeVerification,
// evaluateGate, changedFileImpact); this file only joins their answers and names the reason for each.
// Transport-neutral: plain objects in, plain objects out, no printing, no process exit.

const unique = (values) => [...new Set(values)].sort();
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function load(projectRoot) {
  const trace = buildTraceability(projectRoot);
  const freshness = checkIndexFreshness(projectRoot);
  const warnings = [];
  if (freshness.status === "missing") warnings.push({ code: "repo-index-missing", reason: "no Repo Index exists, so modules and test targets are unknown; run spectra index" });
  if (freshness.status === "stale") warnings.push({ code: "repo-index-stale", reason: "the Repo Index no longer matches the repository; module and test-target answers may be outdated; run spectra index" });
  return { trace, evidence: readVerificationEvidence(projectRoot), records: freshness.cached?.records ?? readIndex(projectRoot)?.records ?? [], warnings };
}

const kindOf = (trace, id) => trace.subjects[id]?.kind ?? (id in trace.locators.modules ? "module" : "test-target");
const ref = (trace, id, provenance) => ({ id, kind: kindOf(trace, id), provenance });
const plain = (id, provenance) => ({ id, provenance });
const edgesTo = (trace, type, to) => trace.edges.filter((edge) => edge.type === type && edge.to === to);

function gateView(trace, evidence, rules) {
  const view = (stage) => {
    const { status, blockers, warnings } = evaluateGate(trace, evidence, stage, { rules });
    return { status, blockers, warnings };
  };
  return { rules, review: view("review"), release: view("release") };
}

function verificationView(conclusion) {
  return {
    state: conclusion.verification,
    reason: conclusion.reason,
    gaps: conclusion.gaps,
    scopes: conclusion.scopes,
    ...(conclusion.subjects ? { subjects: conclusion.subjects.map(({ id, verification, reason }) => ({ id, state: verification, reason })) } : {})
  };
}

const broken = (trace, owners) => trace.unresolved.filter((entry) => owners.includes(entry.from)).map((entry) => ({ code: "broken-canonical-relationship", type: entry.type, from: entry.from, target: entry.target, reason: entry.reason }));

// Explains one stable ID: a business rule, requirement, scenario, invariant, Repo Index module or test
// target. Returns null for an ID that names none of them (never fuzzy-matched).
function inspectSubject(projectRoot, id) {
  const { trace, evidence, records, warnings } = load(projectRoot);
  const record = records.find((candidate) => candidate.id === id);
  if (!trace.subjects[id] && !(record && (record.kind === "module" || record.kind === "test-target"))) {
    return { found: false, kind: record?.kind ?? null };
  }
  const kind = trace.subjects[id]?.kind ?? record.kind;
  const result = { found: true, subject: { id, kind, status: trace.subjects[id]?.status ?? record?.status ?? null, source: trace.locators.sources[id] ?? record?.path ?? null }, relationships: {}, modules: [], warnings };

  if (trace.subjects[id]) {
    const detail = traceSubject(trace, id);
    const rule = kind === "business-rule";
    const rules = rule ? [id] : detail.governedBy;
    const canonical = (ids) => ids.map((target) => ref(trace, target, "canonical"));
    result.relationships = rule
      ? { governs: canonical(detail.governs), coveredSubjects: canonical(detail.governsClosure.filter((target) => !detail.governs.includes(target))) }
      : {
        ...(kind === "acceptance-scenario" ? { covers: canonical(detail.requirements) } : { coveredBy: canonical(detail.coveredBy) }),
        governedBy: canonical(rules),
        verifiedBy: detail.scopes.map((target) => plain(target, "canonical"))
      };
    if (rule) result.relationships.verifiedBy = unique(detail.governsClosure.flatMap((target) => traceSubject(trace, target).scopes)).map((target) => plain(target, "canonical"));
    result.modules = detail.modules.map((module) => ({ id: module.id, via: module.via, testTargets: module.testTargets.map((target) => plain(target, "derived")) }));
    result.verification = verificationView(concludeVerification(trace, evidence, id));
    result.gate = gateView(trace, evidence, rules);
    result.warnings = [...warnings, ...broken(trace, [id, ...(rule ? detail.governsClosure : detail.coveredBy)])];
  } else if (kind === "module") {
    const rules = unique(edgesTo(trace, "affectsModule", id).map((edge) => edge.from));
    result.relationships = {
      affectedByRules: rules.map((rule) => ref(trace, rule, "canonical")),
      testTargets: unique(trace.edges.filter((edge) => edge.type === "testedBy" && edge.from === id).map((edge) => edge.to)).map((target) => plain(target, "derived"))
    };
    result.verification = { rules: rules.map((rule) => ({ id: rule, state: concludeVerification(trace, evidence, rule).verification })) };
    result.gate = gateView(trace, evidence, rules);
  } else {
    const subjects = unique(edgesTo(trace, "verifiedBy", id).map((edge) => edge.from));
    const rules = unique(Object.keys(trace.subjects).filter((rule) => trace.subjects[rule].kind === "business-rule" && trace.subjects[rule].status === "active" && traceSubject(trace, rule).governsClosure.some((target) => subjects.includes(target))));
    result.relationships = {
      verifies: subjects.map((subject) => ref(trace, subject, "canonical")),
      testsModules: unique(edgesTo(trace, "testedBy", id).map((edge) => edge.from)).map((module) => ref(trace, module, "derived"))
    };
    const states = subjects.map((subject) => ({ id: subject, state: concludeVerification(trace, evidence, subject).verification }));
    const scope = subjects.flatMap((subject) => concludeVerification(trace, evidence, subject).scopes).find((entry) => entry.target === id);
    result.verification = { subjects: states, evidence: scope ? { result: scope.result, fresh: scope.fresh, granularity: scope.granularity, staleBecause: scope.staleBecause } : null };
    result.gate = gateView(trace, evidence, rules);
  }
  return result;
}

// What the given changed files (data-relative paths) concern: modules, canonical subjects, rules,
// verification scopes, verification state and review/release implications. The rule set is the review
// gate's own (changedFileImpact); the rest is read off the trace by explicit relationships. No lexical
// matching, no scoring.
function analyzeImpact(projectRoot, files, scope) {
  const { trace, evidence, warnings: loadWarnings } = load(projectRoot);
  const impact = changedFileImpact(trace, files);
  const ruleIds = impact.rules.map((rule) => rule.id);
  const owner = (file) => impact.modules.filter((module) => module.files.includes(file)).map((module) => module.id)
    .sort((a, b) => trace.locators.modules[b].length - trace.locators.modules[a].length)[0] ?? null;

  const subjects = new Map();
  const touch = (id, reason, direct) => {
    const entry = subjects.get(id) ?? { id, kind: trace.subjects[id].kind, direct: false, reasons: [] };
    entry.direct ||= direct;
    entry.reasons.push(reason);
    subjects.set(id, entry);
  };
  for (const id of impact.changedSubjects.filter((candidate) => trace.subjects[candidate].kind !== "business-rule")) touch(id, "source-file-changed", true);
  for (const rule of ruleIds) for (const id of traceSubject(trace, rule).governsClosure) touch(id, `governed-by:${rule}`, false);
  const canonicalSubjects = [...subjects.values()].map((entry) => ({ ...entry, reasons: unique(entry.reasons) })).sort(byId);

  const scopes = new Map();
  const addScope = (target, reason) => scopes.set(target, [...(scopes.get(target) ?? []), reason]);
  for (const subject of canonicalSubjects) for (const target of traceSubject(trace, subject.id).scopes) addScope(target, `verified-by:${subject.id}`);
  for (const module of impact.modules) for (const edge of trace.edges.filter((candidate) => candidate.type === "testedBy" && candidate.from === module.id)) addScope(edge.to, `tested-by-module:${module.id}`);
  const verificationScopes = [...scopes].map(([id, reasons]) => ({ id, explicit: reasons.some((reason) => reason.startsWith("verified-by:")), reasons: unique(reasons), action: `spectra verify --test-target ${id}` })).sort(byId);

  const conclusions = [...ruleIds, ...canonicalSubjects.map((subject) => subject.id)].map((id) => ({ id, kind: trace.subjects[id].kind, c: concludeVerification(trace, evidence, id) }));
  const review = evaluateGate(trace, evidence, "review", { rules: ruleIds });
  const release = evaluateGate(trace, evidence, "release", { rules: null });
  const warnings = [...loadWarnings];
  for (const file of files) {
    if (!owner(file) && !impact.changedSubjects.some((id) => trace.locators.sources[id] === file)) warnings.push({ code: "file-outside-known-modules", file, reason: "no Repo Index module contains this file and it is not the source of a canonical subject" });
  }
  if (files.length > 0 && ruleIds.length === 0) warnings.push({ code: "no-rules-in-scope", reason: "the changed files concern no active rule: none affects their module and none is defined in or governs a subject defined in them" });

  return {
    scope,
    outcome: files.length === 0 ? "no-changed-files" : ruleIds.length === 0 ? "no-rule-impact" : "impact",
    files: files.map((file) => ({ path: file, module: owner(file) })),
    modules: impact.modules.map((module) => ({ id: module.id, reason: "contains-changed-file" })),
    canonicalSubjects,
    rules: impact.rules.map((rule) => ({ ...rule, direct: rule.reasons.some((reason) => reason === "source-file-changed" || reason.startsWith("governs-changed-subject:")) })),
    verificationScopes,
    verificationState: conclusions.map(({ id, kind, c }) => ({ id, kind, state: c.verification, reason: c.reason })),
    reviewImpact: { status: review.status, blockers: review.blockers, warnings: review.warnings },
    releaseImpact: { status: release.status, blockersInScope: release.blockers.filter((blocker) => ruleIds.includes(blocker.rule)), projectBlockers: release.blockers.length },
    warnings
  };
}

export { analyzeImpact, inspectSubject };
