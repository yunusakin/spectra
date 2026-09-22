// Stable public surface of the context subsystem. Implementation lives in
// ./context/*: policies and budgets, source definitions, markdown parsing,
// summary generation, and pack selection.
export { buildContextPack, estimateTokensFromFile } from "./context/pack.js";
export { ensureContextSummaries } from "./context/summaries.js";
export { normalizeGoal, normalizeRole } from "./context/policies.js";
