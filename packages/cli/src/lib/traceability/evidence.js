import fs from "node:fs";
import path from "node:path";
import { getCacheRoot } from "../project-layout.js";
import { sortKeysDeep } from "../index/cache.js";
import { loadKnowledgeMap } from "../knowledge/map.js";
import { buildTraceability, traceSubject } from "./trace.js";

// Verification = what evidence currently supports a connection. Evidence is a recorded result for a
// Repo Index test target plus the signatures (Knowledge Map / Repo Index) of everything that result
// supported; it is a local, disposable cache and never canonical. A subject's evidence is the fresh
// result of the test targets it names in its own canonical `verifiedBy` (its explicit verification
// scope); "the module has tests", approvals and review findings are not evidence, and a result is
// never attributed to a subject that did not name the target. One record per test target (the latest
// result replaces the previous one).

const EVIDENCE_CONTRACT_VERSION = 1;
const RESULTS = new Set(["passed", "failed"]);

function evidenceFile(projectRoot) {
  return path.join(getCacheRoot(projectRoot), "verification", "evidence.json");
}

// Never throws: a missing or corrupt cache is "no evidence".
function readVerificationEvidence(projectRoot) {
  const file = evidenceFile(projectRoot);
  if (!fs.existsSync(file)) return { status: "missing", records: [], file };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed?.contractVersion !== EVIDENCE_CONTRACT_VERSION || !Array.isArray(parsed.records)) throw new Error("shape");
    return { status: "ok", records: parsed.records, file };
  } catch {
    return { status: "corrupt", records: [], file };
  }
}

// All IDs a result for `testTarget` supports: the target, every subject that names it in `verifiedBy`,
// the rules governing those subjects and the modules those rules affect that the target tests.
function supportedIds(trace, testTarget) {
  const ids = new Set([testTarget]);
  const subjects = trace.edges.filter((edge) => edge.type === "verifiedBy" && edge.to === testTarget).map((edge) => edge.from);
  for (const subject of subjects) ids.add(subject);
  for (const rule of Object.keys(trace.subjects).filter((id) => trace.subjects[id].kind === "business-rule")) {
    const detail = traceSubject(trace, rule);
    if (!detail.governsClosure.some((id) => subjects.includes(id))) continue;
    ids.add(rule);
    for (const module of detail.modules.filter((candidate) => candidate.testTargets.includes(testTarget))) ids.add(module.id);
  }
  return [...ids].sort();
}

// Signatures of everything a result for `testTarget` would support, as of now. A producer takes this
// BEFORE it runs the tests, so an edit made while they run leaves the evidence stale.
function observeSupport(projectRoot, testTarget) {
  const trace = buildTraceability(projectRoot);
  return Object.fromEntries(supportedIds(trace, testTarget).map((id) => [id, trace.signatures[id] ?? null]));
}

// `granularity`: "test-target" when the command is exactly the target's own, "aggregate" when it fans
// out to other targets (it then only supports paths through that aggregate target itself).
// One writer at a time: recording is read-modify-write over a single file, so two runs finishing
// together must not drop each other's record. A lock older than `staleMs` is a crashed run's.
function withEvidenceLock(file, work, { timeoutMs = 10_000, staleMs = 60_000 } = {}) {
  const lock = `${file}.lock`;
  const token = `${process.pid}-${Math.random()}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.writeFileSync(lock, token, { flag: "wx" });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const age = Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > staleMs) {
        // rename is atomic: of several runs that judged the lock stale only one moves it away.
        const tomb = `${lock}.stale-${token}`;
        try {
          fs.renameSync(lock, tomb);
          const movedAge = Date.now() - fs.statSync(tomb).mtimeMs;
          // we grabbed a live lock someone created after our check: put it back
          if (movedAge <= staleMs) fs.renameSync(tomb, lock);
          else fs.rmSync(tomb, { force: true });
        } catch {
          // another run already moved it
        }
        continue;
      }
      if (Date.now() > deadline) throw new Error("The verification evidence cache is locked by another run; try again.");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return work();
  } finally {
    // only release a lock that is still ours
    let owner = null;
    try {
      owner = fs.readFileSync(lock, "utf8");
    } catch {
      // already gone
    }
    if (owner === token) fs.rmSync(lock, { force: true });
  }
}

function recordVerificationEvidence(projectRoot, { testTarget, result, command = null, granularity = "test-target", observed = null, lockTimeoutMs = 10_000 }) {
  if (!RESULTS.has(result)) throw new Error(`Invalid verification result: ${result} (expected passed or failed)`);
  if (!(loadKnowledgeMap(projectRoot).map.byKind["test-target"] ?? []).includes(testTarget)) throw new Error(`Unknown test target: ${testTarget}`);
  const support = observed ?? observeSupport(projectRoot, testTarget);
  const file = evidenceFile(projectRoot);
  const records = withEvidenceLock(file, () => {
    const next = [...readVerificationEvidence(projectRoot).records.filter((record) => record.testTarget !== testTarget), { testTarget, result, command, granularity, observed: support }]
      .sort((a, b) => (a.testTarget < b.testTarget ? -1 : 1));
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(sortKeysDeep({ contractVersion: EVIDENCE_CONTRACT_VERSION, records: next }), null, 2)}\n`, "utf8");
    fs.renameSync(temporary, file);
    return next;
  }, { timeoutMs: lockTimeoutMs });
  return { file, record: records.find((record) => record.testTarget === testTarget) };
}

// Evidence is fresh only while every signature it observed is unchanged.
function staleBecause(record, trace) {
  return Object.entries(record.observed ?? {}).filter(([id, signature]) => (trace.signatures[id] ?? null) !== signature).map(([id]) => id).sort();
}

// A result supports only what it observed, and only what it observed about the ids that matter to
// the conclusion asked for: the subject, the target, and for a rule the rule and its affected modules
// tested by that target. An id the record never saw (a subject or rule added or re-pointed after the
// result) counts as changed.
function staleFor(record, trace, ids) {
  const observed = record.observed ?? {};
  return [...new Set(ids)].filter((id) => !(id in observed) || (trace.signatures[id] ?? null) !== observed[id]).sort();
}

// What one explicit scope (a test target named by `subject`) currently says about it.
function scopeState(trace, records, subject, target, extraIds = []) {
  const record = records.find((candidate) => candidate.testTarget === target);
  if (!record) return { subject, target, result: null, fresh: false, granularity: null, staleBecause: [] };
  const stale = staleFor(record, trace, [subject, target, ...extraIds]);
  return { subject, target, result: record.result, fresh: stale.length === 0, granularity: record.granularity ?? "test-target", staleBecause: stale };
}

// failed (fresh failed required scope) > stale (outdated evidence) > unverified (gap or no evidence) > verified.
function rollUp(scopes, gaps) {
  if (scopes.some((scope) => scope.fresh && scope.result === "failed")) return "failed";
  if (scopes.some((scope) => scope.result && !scope.fresh)) return "stale";
  if (gaps.length > 0 || scopes.length === 0 || scopes.some((scope) => !scope.result)) return "unverified";
  return "verified";
}

function describeScope(scope) {
  const label = `${scope.subject} via ${scope.target}${scope.granularity === "aggregate" ? " (aggregate)" : ""}`;
  if (!scope.result) return `${label}: no evidence recorded`;
  if (!scope.fresh) return `${label}: ${scope.result} result is stale (${scope.staleBecause.join(", ")} changed)`;
  return `${label}: fresh ${scope.result}`;
}

const REASONS = {
  failed: "a required verification scope failed",
  stale: "evidence exists but supporting knowledge or repository evidence changed",
  verified: "every required verification scope has fresh passing evidence"
};

const ORDER = ["failed", "stale", "unverified", "verified"];
const strongest = (states) => ORDER.find((state) => states.includes(state)) ?? "unverified";

// One subject judged by its own explicit scopes only.
function ownConclusion(trace, records, id) {
  const detail = traceSubject(trace, id);
  const scopes = detail.scopes.map((target) => scopeState(trace, records, id, target));
  const gaps = scopes.length === 0 ? ["missing verification scope: no verifiedBy target names an executable scope"] : [];
  const verification = rollUp(scopes, gaps);
  const reason = verification === "unverified" ? (gaps[0] ?? "no evidence recorded for a required verification scope") : REASONS[verification];
  return { id, kind: trace.subjects[id].kind, detail, verification, reason, gaps, scopes };
}

// A requirement is verified only when its own scopes are AND every scenario that canonically covers it
// is (`AC covers FR`); neither inherits the other's scope. Precedence failed > stale > unverified > verified.
function concludeSubject(trace, records, id) {
  const own = ownConclusion(trace, records, id);
  const components = own.detail.coveredBy.map((ac) => ownConclusion(trace, records, ac));
  const verification = strongest([own.verification, ...components.map((entry) => entry.verification)]);
  const driver = verification === own.verification ? null : components.find((entry) => entry.verification === verification);
  const reason = driver ? `${driver.id}: ${driver.reason}` : own.reason;
  const scopes = [...own.scopes, ...components.flatMap((entry) => entry.scopes)];
  const gaps = [...own.gaps, ...components.flatMap((entry) => entry.gaps.map((gap) => `${entry.id}: ${gap}`))];
  const detail = own.detail;
  return {
    id, kind: own.kind, traceability: { complete: detail.complete, missing: detail.missing }, modulesWithoutTestTarget: detail.modulesWithoutTestTarget,
    verification, reason, gaps, scopes,
    components: components.map((entry) => ({ id: entry.id, verification: entry.verification, reason: entry.reason })),
    explanation: [...scopes.map(describeScope), ...gaps]
  };
}

function concludeRule(trace, records, id) {
  const subject = traceSubject(trace, id);
  const base = { id, kind: "business-rule", traceability: { complete: subject.complete, missing: subject.missing }, modulesWithoutTestTarget: subject.modulesWithoutTestTarget };
  const governed = subject.governs.map((target) => concludeSubject(trace, records, target));
  const gaps = [];
  if (governed.length === 0) gaps.push("missing canonical subject: the rule governs no requirement, scenario or invariant");
  const named = new Set(governed.flatMap((entry) => entry.scopes.map((scope) => scope.target)));
  for (const module of subject.modules) {
    if (module.testTargets.length === 0) gaps.push(`module ${module.id} has no test target`);
    else if (!module.testTargets.some((target) => named.has(target))) gaps.push(`module ${module.id} has test target(s) but no governed subject names one as its verification scope`);
  }
  for (const entry of governed) gaps.push(...entry.gaps.map((gap) => (/^[^ ]+#[^ ]+: /.test(gap) ? gap : `${entry.id}: ${gap}`)));
  const seen = new Set();
  const scopes = governed.flatMap((entry) => entry.scopes).filter((scope) => !seen.has(`${scope.subject}\t${scope.target}`) && seen.add(`${scope.subject}\t${scope.target}`))
    .map((scope) => scopeState(trace, records, scope.subject, scope.target, [id, ...subject.modules.filter((module) => module.testTargets.includes(scope.target)).map((module) => module.id)]));
  const verification = rollUp(scopes, gaps);
  const reason = verification === "unverified" ? (gaps[0] ?? "no evidence recorded for a required verification scope") : REASONS[verification];
  const subjects = governed.map(({ id: subjectId, verification: state, reason: why, components }) => ({ id: subjectId, verification: state, reason: why, ...(components?.length ? { components } : {}) }));
  return { ...base, verification, reason, gaps, subjects, scopes, explanation: [...subjects.map((entry) => `${entry.id}: ${entry.verification} (${entry.reason})`), ...scopes.map(describeScope), ...gaps.filter((gap) => /^module|^missing canonical/.test(gap))] };
}

function concludeVerification(trace, evidence, id) {
  const records = evidence?.records ?? [];
  const kind = trace.subjects[id]?.kind;
  if (!kind) return { id, kind: null, verification: "unverified", reason: "unknown subject", gaps: ["unknown subject"], scopes: [], explanation: [] };
  return kind === "business-rule" ? concludeRule(trace, records, id) : concludeSubject(trace, records, id);
}

export { concludeVerification, observeSupport, readVerificationEvidence, recordVerificationEvidence, staleBecause, withEvidenceLock };
