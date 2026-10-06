import { collectRuleSections, enumerateFeatureObjects } from "../knowledge/address.js";
import { readIndex } from "../index/cache.js";
import { buildTraceability } from "./trace.js";
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

const SCOPE_SYNTAX = /^[A-Za-z0-9][A-Za-z0-9._:/@#-]*$/;

// Canonical `verifiedBy` scopes: syntax, duplicates, self-links, and (when a Repo Index exists)
// that every target exists and is a test target. Absence is valid: it only means verification
// coverage is incomplete.
function validateVerificationScopes(projectRoot) {
  const errors = [];
  let entries = [];
  try {
    entries = enumerateFeatureObjects(projectRoot);
  } catch {
    return errors;
  }
  let kinds = null;
  try {
    kinds = new Map(readIndex(projectRoot).records.map((record) => [record.id, record.kind]));
  } catch {
    // no Repo Index yet: existence cannot be judged
  }
  const subjectKinds = new Map(entries.map(({ reference }) => [reference.id, reference.kind]));
  for (const { reference, declaredVerifiedBy } of entries) {
    if (declaredVerifiedBy === undefined) continue;
    if (!Array.isArray(declaredVerifiedBy) || declaredVerifiedBy.length === 0) {
      errors.push(`${reference.id} verifiedBy must be a non-empty list of test target IDs.`);
      continue;
    }
    const seen = new Set();
    for (const target of declaredVerifiedBy.map(String)) {
      if (!SCOPE_SYNTAX.test(target)) errors.push(`${reference.id} verifiedBy target '${target}' has invalid ID syntax.`);
      else if (seen.has(target)) errors.push(`${reference.id} has duplicate verifiedBy target ${target}.`);
      else if (target === reference.id) errors.push(`${reference.id} verifiedBy cannot reference itself.`);
      else {
        const kind = kinds?.get(target) ?? subjectKinds.get(target);
        if (kind !== undefined && kind !== "test-target") errors.push(`${reference.id} verifiedBy target ${target} is not a test target (${kind}).`);
        else if (kind === undefined && kinds) errors.push(`${reference.id} verifiedBy target ${target} does not exist in the Repo Index.`);
      }
      seen.add(target);
    }
  }
  return errors;
}

// Structurally valid canonical knowledge can still be one the review/release gates will refuse. `check` stays a structural
// verdict, but it names this gap from the very data the gates evaluate (trace.unresolved), so the two cannot describe
// different problems. Without a Repo Index modules cannot be judged, so nothing is claimed.
function verificationReadinessWarnings(projectRoot) {
  let trace;
  try {
    if (!readIndex(projectRoot)) return [];
    trace = buildTraceability(projectRoot);
  } catch {
    return [];
  }
  const seen = new Set();
  return trace.unresolved.filter((entry) => entry.type === "affectsModule").flatMap((entry) => {
    const message = `Verification readiness: ${entry.from} lists Affected Modules entry "${entry.target}" that does not resolve to a Repo Index module; the review and release gates will block until it does (spectra verify --gate review).`;
    return seen.has(message) ? [] : (seen.add(message), [message]);
  });
}

export { validateGovernsLinks, validateVerificationScopes, verificationReadinessWarnings };
