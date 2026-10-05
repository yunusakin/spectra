import { concludeVerification } from "./evidence.js";

// Stage gates over verification state. Two inputs only: the trace (canonical structure) and the local
// evidence. Nothing runs tests, nothing grants approval, and structural validation stays in the
// validators (the trace's unresolved edges are reported, not re-validated).
//
// Effective policy:
//   implementation  always allowed  - a failed/stale/missing result must never block the edit that repairs it
//                                     (states are still listed as warnings so the work is explainable)
//   review, release blocked by      - a declared (`verifiedBy`) required scope that failed, is stale or has no
//                                     evidence, and by broken canonical structure
//   warnings (never block)          - coverage-not-modeled, missing-canonical-subject, module-without-test-target,
//                                     module-scope-not-named
// Review can be narrowed to the rules a set of changed files concerns; release is project-wide by design.

const STAGES = ["implementation", "review", "release"];
const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

// Rules concerned by changed files (data-relative paths): rules that affect a module containing the
// file, rules defined in a changed file, and rules governing a subject defined in a changed file.
function rulesForChangedFiles(trace, files) {
  const rules = Object.keys(trace.subjects).filter((id) => trace.subjects[id].kind === "business-rule" && trace.subjects[id].status === "active");
  const inModule = (file, modulePath) => modulePath !== "." && (file === modulePath || file.startsWith(`${modulePath}/`));
  const modules = Object.entries(trace.locators.modules).filter(([, modulePath]) => files.some((file) => inModule(file, modulePath))).map(([id]) => id);
  const sources = new Set(files);
  const changedSubjects = Object.keys(trace.locators.sources).filter((id) => sources.has(trace.locators.sources[id]));
  return rules.filter((rule) => {
    if (changedSubjects.includes(rule)) return true;
    const edges = trace.edges.filter((edge) => edge.from === rule);
    if (edges.some((edge) => edge.type === "affectsModule" && modules.includes(edge.to))) return true;
    const governed = edges.filter((edge) => edge.type === "governs").map((edge) => edge.to);
    const closure = [...governed, ...trace.edges.filter((edge) => edge.type === "covers" && governed.includes(edge.to)).map((edge) => edge.from)];
    return closure.some((id) => changedSubjects.includes(id));
  }).sort();
}

function evaluateGate(trace, evidence, stage, { rules = null } = {}) {
  if (!STAGES.includes(stage)) throw new Error(`Unknown gate stage: ${stage} (expected ${STAGES.join(", ")})`);
  const active = Object.keys(trace.subjects).filter((id) => trace.subjects[id].kind === "business-rule" && trace.subjects[id].status === "active").sort();
  const inScope = rules ? active.filter((id) => rules.includes(id)) : active;
  const blockers = [];
  const warnings = [];
  const rerun = (scope) => `spectra verify --test-target ${scope}`;

  for (const rule of inScope) {
    const conclusion = concludeVerification(trace, evidence, rule);
    if (conclusion.subjects.length === 0) warnings.push({ key: `${rule}\t0`, code: "missing-canonical-subject", rule, reason: "the rule governs no requirement, scenario or invariant" });
    for (const scope of conclusion.scopes) {
      const item = { rule, subject: scope.subject, scope: scope.target, granularity: scope.granularity };
      if (!scope.result) blockers.push({ key: `${rule}\t${scope.subject}\t${scope.target}`, code: "required-scope-no-evidence", ...item, evidence: "none", reason: "the subject declares this scope as required verification and no result is recorded", action: rerun(scope.target) });
      else if (!scope.fresh) blockers.push({ key: `${rule}\t${scope.subject}\t${scope.target}`, code: "stale-evidence", ...item, evidence: "stale", staleBecause: scope.staleBecause, reason: `the ${scope.result} result is outdated: ${scope.staleBecause.join(", ")} changed since it was recorded`, action: rerun(scope.target) });
      else if (scope.result === "failed") blockers.push({ key: `${rule}\t${scope.subject}\t${scope.target}`, code: "failed-evidence", ...item, evidence: "failed", reason: `required verification scope failed${scope.granularity === "aggregate" ? " (aggregate target: the failure may be in any test it runs)" : ""}`, action: `fix the failure, then ${rerun(scope.target)}` });
    }
    for (const gap of conclusion.gaps) {
      const subject = gap.match(/^([^ :]+#[^ :]+): /)?.[1] ?? null;
      const module = gap.match(/^module (\S+) /)?.[1] ?? null;
      if (/missing verification scope/.test(gap)) warnings.push({ key: `${rule}\t1\t${subject}`, code: "coverage-not-modeled", rule, subject, reason: "the subject declares no verifiedBy scope, so no verification is required of it" });
      else if (/has no test target/.test(gap)) warnings.push({ key: `${rule}\t2\t${module}`, code: "module-without-test-target", rule, module, reason: gap });
      else if (module) warnings.push({ key: `${rule}\t3\t${module}`, code: "module-scope-not-named", rule, module, reason: gap });
    }
    if (stage !== "implementation") {
      for (const broken of trace.unresolved.filter((entry) => entry.from === rule || conclusion.scopes.concat(conclusion.subjects).some((scope) => (scope.subject ?? scope.id) === entry.from))) {
        blockers.push({ key: `${rule}\t~\t${broken.from}\t${broken.target}`, code: "broken-canonical-structure", rule, subject: broken.from, scope: broken.target, evidence: "none", reason: `${broken.type} target ${broken.target} is invalid: ${broken.reason}`, action: "fix the canonical link (spectra validate reports it)" });
      }
    }
  }
  const dedupe = (items) => [...new Map(items.sort(byKey).map((item) => [item.key, item])).values()].map(({ key, ...rest }) => rest);
  // Implementation never blocks: what would block elsewhere is shown as warnings of the same code.
  const shown = stage === "implementation" ? { blockers: [], warnings: [...warnings, ...blockers.filter((item) => item.code !== "broken-canonical-structure")] } : { blockers, warnings };
  return {
    stage,
    status: shown.blockers.length > 0 ? "blocked" : "allowed",
    scope: { kind: rules ? "changed" : "project", rules: inScope },
    blockers: dedupe(shown.blockers),
    warnings: dedupe(shown.warnings)
  };
}

export { STAGES, evaluateGate, rulesForChangedFiles };
