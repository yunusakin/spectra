import { concludeVerification } from "./evidence.js";
import { traceabilityMetrics } from "./metrics.js";

// Proposed stage-specific enforcement policy, modelled and tested but NOT wired to any command:
// Spectra exposes the state, a later phase decides what blocks. Rationale per condition:
//  - broken canonical structure is invalid everywhere;
//  - a coverage gap is incomplete, not wrong: it warns and never blocks on its own;
//  - failed/stale required evidence blocks the stages that claim completion (review, release) but never
//    implementation, because the edit that fixes a failing or stale result must stay possible.
const GATE_POLICY = {
  "broken-canonical-edge": { implementation: "block", review: "block", release: "block" },
  "missing-canonical-subject": { implementation: "allow", review: "warn", release: "warn" },
  "missing-verification-scope": { implementation: "allow", review: "warn", release: "warn" },
  "missing-evidence": { implementation: "allow", review: "warn", release: "warn" },
  "stale-evidence": { implementation: "allow", review: "block", release: "block" },
  "failed-evidence": { implementation: "allow", review: "block", release: "block" }
};

// Conditions currently present, derived from the active rules' conclusions and the scope metrics.
function presentConditions(trace, evidence) {
  const metrics = traceabilityMetrics(trace, evidence);
  const rules = Object.keys(trace.subjects).filter((id) => trace.subjects[id].kind === "business-rule" && trace.subjects[id].status === "active");
  const conclusions = rules.map((id) => concludeVerification(trace, evidence, id));
  const gap = (pattern) => conclusions.some((entry) => entry.gaps.some((text) => pattern.test(text)));
  return {
    "broken-canonical-edge": metrics.brokenEdges > 0,
    "missing-canonical-subject": metrics.rulesWithCanonicalSubject < metrics.activeRules,
    "missing-verification-scope": metrics.subjectsWithScope < metrics.canonicalSubjects || gap(/verification scope|no test target/),
    "missing-evidence": metrics.scopes.noEvidence > 0,
    "stale-evidence": metrics.scopes.stale > 0,
    "failed-evidence": metrics.scopes.freshFailed > 0
  };
}

function evaluateGates(trace, evidence) {
  const present = presentConditions(trace, evidence);
  const gates = {};
  for (const stage of ["implementation", "review", "release"]) {
    const conditions = Object.keys(GATE_POLICY).filter((name) => present[name]);
    gates[stage] = Object.fromEntries(["block", "warn"].map((level) => [level, conditions.filter((name) => GATE_POLICY[name][stage] === level)]));
  }
  return gates;
}

export { GATE_POLICY, evaluateGates };
