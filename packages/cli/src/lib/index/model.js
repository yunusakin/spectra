const KINDS = new Set([
  "project",
  "module",
  "entrypoint",
  "test-target",
  "build-target",
  "dependency",
  "runtime",
  "config",
  "documentation",
  "candidate-domain-hint"
]);

const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const STATUS_VALUES = new Set(["confirmed", "candidate"]);

function assertRecordShape(record) {
  if (!KINDS.has(record.kind)) {
    throw new Error(`Unknown index record kind: ${record.kind}`);
  }
  if (!CONFIDENCE_LEVELS.has(record.confidence)) {
    throw new Error(`Invalid confidence for record ${record.id}: ${record.confidence}`);
  }
  if (!STATUS_VALUES.has(record.status)) {
    throw new Error(`Invalid status for record ${record.id}: ${record.status}`);
  }
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    throw new Error(`Record ${record.id} must carry at least one evidence entry`);
  }
}

function makeRecordId(ecosystem, kind, name) {
  const safeName = String(name).replace(/[^a-zA-Z0-9/_.@:-]/g, "_");
  return `${ecosystem}:${kind}:${safeName}`;
}

function createRecord({
  kind,
  name,
  path: recordPath,
  ecosystem,
  confidence,
  status,
  evidence,
  attributes = {},
  relationships = {}
}) {
  const record = {
    id: makeRecordId(ecosystem, kind, recordPath ?? name),
    kind,
    name,
    path: recordPath ?? null,
    ecosystem,
    confidence,
    status,
    evidence,
    attributes,
    relationships: {
      dependsOn: relationships.dependsOn ?? [],
      testedBy: relationships.testedBy ?? [],
      ownedByCandidate: relationships.ownedByCandidate ?? [],
      relatedDocs: relationships.relatedDocs ?? []
    }
  };
  assertRecordShape(record);
  return record;
}

function evidenceEntry(file, field) {
  return field ? { file, field } : { file };
}

export { createRecord, evidenceEntry, makeRecordId, KINDS, CONFIDENCE_LEVELS, STATUS_VALUES };
