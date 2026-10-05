import { concludeVerification, staleBecause } from "./evidence.js";
import { traceSubject } from "./trace.js";

// Factual coverage counts, kept apart on purpose: canonical (rules with a governed subject),
// scope (subjects naming an explicit verifiedBy target), execution evidence (fresh/stale/failed
// per scope target) and verified (conclusions). No weighted score.
const REQUIREMENT_KINDS = new Set(["functional-requirement", "non-functional-requirement"]);
const count = (items, key) => items.reduce((totals, item) => ({ ...totals, [item[key]]: totals[item[key]] + 1 }), { verified: 0, failed: 0, stale: 0, unverified: 0 });

function traceabilityMetrics(trace, evidence) {
  const ids = Object.keys(trace.subjects);
  const rules = ids.filter((id) => trace.subjects[id].kind === "business-rule" && trace.subjects[id].status === "active");
  const requirements = ids.filter((id) => REQUIREMENT_KINDS.has(trace.subjects[id].kind));
  const ruleTraces = rules.map((id) => traceSubject(trace, id));
  const requirementTraces = requirements.map((id) => traceSubject(trace, id));
  const records = evidence?.records ?? [];
  const governed = [...new Set(ruleTraces.flatMap((entry) => entry.governs))].sort();
  const scopeTargets = [...new Set(governed.flatMap((id) => traceSubject(trace, id).scopes))].sort();
  const subjectConclusions = governed.map((id) => concludeVerification(trace, evidence, id));
  // One state per scope target, judged over every subject that names it: stale if any naming subject's
  // view of the result is outdated, else failed/passed by the fresh result, else no evidence.
  const states = scopeTargets.map((target) => {
    const views = subjectConclusions.flatMap((entry) => entry.scopes).filter((scope) => scope.target === target);
    if (views.some((scope) => !scope.result)) return "noEvidence";
    if (views.some((scope) => !scope.fresh)) return "stale";
    return views.some((scope) => scope.result === "failed") ? "freshFailed" : "freshPassed";
  });
  return {
    activeRules: rules.length,
    rulesWithRequirementLink: ruleTraces.filter((entry) => entry.requirements.length > 0).length,
    rulesWithCanonicalSubject: ruleTraces.filter((entry) => entry.governs.length > 0).length,
    canonicalSubjects: governed.length,
    subjectsWithScope: governed.filter((id) => traceSubject(trace, id).scopes.length > 0).length,
    requirements: requirements.length,
    requirementsWithGoverningRule: requirementTraces.filter((entry) => entry.governedBy.length > 0).length,
    requirementsWithModule: requirementTraces.filter((entry) => entry.modules.length > 0).length,
    requirementsWithTestTarget: requirementTraces.filter((entry) => entry.testTargets.length > 0).length,
    rulesWithCompletePath: ruleTraces.filter((entry) => entry.complete).length,
    brokenEdges: trace.unresolved.length,
    verification: count(rules.map((id) => ({ verification: concludeVerification(trace, evidence, id).verification })), "verification"),
    subjectVerification: count(subjectConclusions, "verification"),
    scopes: {
      total: scopeTargets.length,
      freshPassed: states.filter((state) => state === "freshPassed").length,
      freshFailed: states.filter((state) => state === "freshFailed").length,
      stale: states.filter((state) => state === "stale").length,
      noEvidence: states.filter((state) => state === "noEvidence").length
    },
    evidence: {
      freshPassed: records.filter((record) => staleBecause(record, trace).length === 0 && record.result === "passed").length,
      freshFailed: records.filter((record) => staleBecause(record, trace).length === 0 && record.result === "failed").length,
      stale: records.filter((record) => staleBecause(record, trace).length > 0).length
    },
    staleEvidence: records.filter((record) => staleBecause(record, trace).length > 0).length
  };
}

export { traceabilityMetrics };
