import { slugify } from "../primitives.js";
import { buildEvalDefaults } from "./eval-defaults.js";
import { buildGovernanceDefaults } from "./governance-defaults.js";
import { buildSpecDefaults } from "./spec-defaults.js";

// Composes the default feature bundle for a project. Each domain owns its own
// defaults; this function only wires the shared identifiers through.
function buildFeatureBundle(projectName) {
  const featureId = `${slugify(projectName)}-core`;
  const safeProjectName = projectName || "Spectra Project";
  const context = { featureId, safeProjectName };

  return {
    featureId,
    ...buildSpecDefaults(context),
    ...buildEvalDefaults(context),
    ...buildGovernanceDefaults(context)
  };
}

export { buildFeatureBundle };
