import { staleBecause, concludeVerification } from "./evidence.js";
import { traceSubject } from "./trace.js";

const REQUIREMENT_KINDS = new Set(["functional-requirement", "non-functional-requirement"]);

// Small deterministic coverage report. Verification counts are over active rules only.
function traceabilityMetrics(trace, evidence) {
  const ids = Object.keys(trace.subjects);
  const rules = ids.filter((id) => trace.subjects[id].kind === "business-rule" && trace.subjects[id].status === "active");
  const requirements = ids.filter((id) => REQUIREMENT_KINDS.has(trace.subjects[id].kind));
  const ruleTraces = rules.map((id) => traceSubject(trace, id));
  const requirementTraces = requirements.map((id) => traceSubject(trace, id));
  const verification = { verified: 0, failed: 0, stale: 0, unverified: 0 };
  for (const id of rules) verification[concludeVerification(trace, evidence, id).verification] += 1;
  return {
    activeRules: rules.length,
    rulesWithRequirementLink: ruleTraces.filter((entry) => entry.requirements.length > 0).length,
    requirements: requirements.length,
    requirementsWithGoverningRule: requirementTraces.filter((entry) => entry.governedBy.length > 0).length,
    requirementsWithModule: requirementTraces.filter((entry) => entry.modules.length > 0).length,
    requirementsWithTestTarget: requirementTraces.filter((entry) => entry.testTargets.length > 0).length,
    rulesWithCompletePath: ruleTraces.filter((entry) => entry.complete).length,
    brokenEdges: trace.unresolved.length,
    verification,
    staleEvidence: (evidence?.records ?? []).filter((record) => staleBecause(record, trace).length > 0).length
  };
}

export { traceabilityMetrics };
