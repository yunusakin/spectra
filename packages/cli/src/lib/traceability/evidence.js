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

// A result only supports a path it observed: ids on the path that the record never saw (a rule or
// requirement added after the result was recorded) make it stale for that path.
function staleForPath(record, trace, entry) {
  const unobserved = [entry.rule, entry.requirement, entry.module, entry.testTarget].filter((id) => !(id in (record.observed ?? {})));
  return [...new Set([...staleBecause(record, trace), ...unobserved])].sort();
}

function concludeVerification(trace, evidence, id) {
  const subject = traceSubject(trace, id);
  const base = { id, traceability: { complete: subject.complete, missing: subject.missing }, modulesWithoutTestTarget: subject.modulesWithoutTestTarget };
  if (!subject.complete) return { ...base, verification: "unverified", reason: `incomplete trace path: missing ${subject.missing.join(", ")}`, paths: [] };

  const records = evidence?.records ?? [];
  const paths = subject.paths.map((entry) => {
    const record = records.find((candidate) => candidate.testTarget === entry.testTarget);
    if (!record) return { ...entry, evidence: null };
    const stale = staleForPath(record, trace, entry);
    return { ...entry, evidence: { result: record.result, fresh: stale.length === 0, staleBecause: stale } };
  });
  const fresh = paths.filter((entry) => entry.evidence?.fresh);
  if (fresh.some((entry) => entry.evidence.result === "failed")) return { ...base, verification: "failed", reason: "a fresh failed result exists on a path", paths };
  if (fresh.some((entry) => entry.evidence.result === "passed")) return { ...base, verification: "verified", reason: "fresh passing evidence on a complete path", paths };
  if (paths.some((entry) => entry.evidence)) return { ...base, verification: "stale", reason: "evidence exists but supporting knowledge or repository evidence changed", paths };
  return { ...base, verification: "unverified", reason: "no evidence recorded for the path's test targets", paths };
}

export { concludeVerification, observeSupport, readVerificationEvidence, recordVerificationEvidence, staleBecause, withEvidenceLock };
