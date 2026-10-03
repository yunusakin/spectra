// Minimal normalized reference to one addressable canonical knowledge object.
// `id` is the semantic identity; `source` is only a locator and may change when
// files move. `status` is the source-native value (never normalized).
function createKnowledgeReference({ id, kind, source, address, provenance, status = null, relationships = {} }) {
  return { id, kind, source, address, provenance, status, relationships };
}

export { createKnowledgeReference };
