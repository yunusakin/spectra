// Stable public surface of the specs subsystem. Implementation lives in
// ./specs/* around clear responsibility boundaries (bundles, validation,
// semantic diff, approval state, evaluation, adoption, verification).
export { approveStage } from "./specs/approval.js";
export { buildAdoptionArtifacts } from "./specs/adoption.js";
export { buildSemanticDiff } from "./specs/semantic-diff.js";
export { computeApprovalState } from "./specs/approval-state.js";
export { ensureV2Scaffolding, getFeatureDirs } from "./specs/feature-bundles.js";
export { hasRealMarkdownContent, readJsonContract, readYamlContract, writeJsonContract, writeYamlContract } from "./specs/primitives.js";
export { runEvalSuite } from "./specs/evaluation.js";
export { validateSpectraV2 } from "./specs/validation.js";
export { verifyV2 } from "./specs/verification.js";
