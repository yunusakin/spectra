import { collectRuleSections, enumerateFeatureObjects } from "../knowledge/address.js";
import { ruleGoverns, ruleGovernsLines, ruleHasEmptyGoverns } from "../business/rule-sections.js";

const TARGET_SYNTAX = /^[A-Za-z0-9][A-Za-z0-9._-]*#[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Canonical `Governs:` links are checked for syntax, duplicates and existing targets. Existing
// projects without the line are valid (nothing is required here).
function validateGovernsLinks(projectRoot) {
  const errors = [];
  let known = null;
  try {
    known = new Set(enumerateFeatureObjects(projectRoot).map(({ reference }) => reference.id));
  } catch {
    // Duplicate feature identities are reported by their own checks; skip existence checks here.
  }
  for (const { section } of collectRuleSections(projectRoot)) {
    if (!section.id) continue;
    if (ruleHasEmptyGoverns(section)) errors.push(`Business rule ${section.id} has an empty Governs line.`);
    if (ruleGovernsLines(section).length > 1) errors.push(`Business rule ${section.id} has more than one Governs line.`);
    const seen = new Set();
    for (const target of ruleGoverns(section)) {
      if (!TARGET_SYNTAX.test(target)) errors.push(`Business rule ${section.id} Governs target '${target}' must be <feature-id>#<object-id>.`);
      else if (seen.has(target)) errors.push(`Business rule ${section.id} declares duplicate Governs target ${target}.`);
      else if (known && !known.has(target)) errors.push(`Business rule ${section.id} Governs target ${target} does not exist.`);
      seen.add(target);
    }
  }
  return errors;
}

export { validateGovernsLinks };
