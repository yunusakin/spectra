import fs from "node:fs";
import path from "node:path";
import { getCacheRoot } from "../project-layout.js";
import { sortKeysDeep } from "../index/cache.js";
import { loadKnowledgeMap } from "../knowledge/map.js";
import { buildTraceability, traceSubject } from "./trace.js";

// Verification = what evidence currently supports a connection. Evidence is a recorded result for a
// Repo Index test target plus the signatures (Knowledge Map / Repo Index) of everything that result
// supported; it is a local, disposable cache and never canonical. A conclusion needs a complete
// trace path AND fresh evidence on it; approvals, review findings and "the module has tests" are
// not evidence. One record per test target (the latest result replaces the previous one).

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

// All IDs a result for `testTarget` supports: every rule, requirement and module on any complete path
// through it, and the test target itself.
function supportedIds(trace, testTarget) {
  const ids = new Set([testTarget]);
  for (const rule of Object.keys(trace.subjects).filter((id) => trace.subjects[id].kind === "business-rule")) {
    for (const entry of traceSubject(trace, rule).paths.filter((candidate) => candidate.testTarget === testTarget)) {
      for (const id of [entry.rule, entry.requirement, entry.module]) ids.add(id);
    }
  }
  return [...ids].sort();
}

function recordVerificationEvidence(projectRoot, { testTarget, result, command = null }) {
  if (!RESULTS.has(result)) throw new Error(`Invalid verification result: ${result} (expected passed or failed)`);
  const trace = buildTraceability(projectRoot);
  if (!(loadKnowledgeMap(projectRoot).map.byKind["test-target"] ?? []).includes(testTarget)) throw new Error(`Unknown test target: ${testTarget}`);
  const observed = Object.fromEntries(supportedIds(trace, testTarget).map((id) => [id, trace.signatures[id] ?? null]));
  const records = [...readVerificationEvidence(projectRoot).records.filter((record) => record.testTarget !== testTarget), { testTarget, result, command, observed }]
    .sort((a, b) => (a.testTarget < b.testTarget ? -1 : 1));
  const file = evidenceFile(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(sortKeysDeep({ contractVersion: EVIDENCE_CONTRACT_VERSION, records }), null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
  return { file, record: records.find((record) => record.testTarget === testTarget) };
}

// Evidence is fresh only while every signature it observed is unchanged.
function staleBecause(record, trace) {
  return Object.entries(record.observed ?? {}).filter(([id, signature]) => (trace.signatures[id] ?? null) !== signature).map(([id]) => id).sort();
}

function concludeVerification(trace, evidence, id) {
  const subject = traceSubject(trace, id);
  const base = { id, traceability: { complete: subject.complete, missing: subject.missing } };
  if (!subject.complete) return { ...base, verification: "unverified", reason: `incomplete trace path: missing ${subject.missing.join(", ")}`, paths: [] };

  const records = evidence?.records ?? [];
  const paths = subject.paths.map((entry) => {
    const record = records.find((candidate) => candidate.testTarget === entry.testTarget);
    if (!record) return { ...entry, evidence: null };
    const stale = staleBecause(record, trace);
    return { ...entry, evidence: { result: record.result, fresh: stale.length === 0, staleBecause: stale } };
  });
  const fresh = paths.filter((entry) => entry.evidence?.fresh);
  if (fresh.some((entry) => entry.evidence.result === "failed")) return { ...base, verification: "failed", reason: "a fresh failed result exists on a path", paths };
  if (fresh.some((entry) => entry.evidence.result === "passed")) return { ...base, verification: "verified", reason: "fresh passing evidence on a complete path", paths };
  if (paths.some((entry) => entry.evidence)) return { ...base, verification: "stale", reason: "evidence exists but supporting knowledge or repository evidence changed", paths };
  return { ...base, verification: "unverified", reason: "no evidence recorded for the path's test targets", paths };
}

export { concludeVerification, readVerificationEvidence, recordVerificationEvidence, staleBecause };
