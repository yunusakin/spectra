import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { parseRuleSections, ruleAffectedModules, ruleStatuses } from "../business/rule-sections.js";
import { readBusinessIndexes, resolveBusinessPath } from "../business/repository.js";
import { rowValue } from "../business/parser.js";
import { getFeatureBundle, getFeatureDirs } from "../specs/feature-bundles.js";
import { readYamlContract, toPosix } from "../specs/primitives.js";
import { sortKeysDeep } from "../index/cache.js";
import { createKnowledgeReference } from "./reference.js";

const PROVENANCE = "human-declared";

// Paths are reported like the context pack does: relative to the data root
// (`sdd/memory-bank/...`), independent of the project layout.
function dataRelative(projectRoot, absolutePath) {
  return toPosix(path.relative(path.dirname(getSddRoot(projectRoot)), absolutePath));
}

// Every valid `## RULE-… — title` section in the business index's rule files,
// in index order. `onlyId` is just a read-avoidance hint for single lookups.
function collectRuleSections(projectRoot, onlyId = null) {
  const { businessRoot, domainRows } = readBusinessIndexes(projectRoot);
  const found = [];
  for (const row of domainRows) {
    for (const relativePath of [rowValue(row, "rules"), rowValue(row, "unresolved")].filter(Boolean)) {
      const filePath = resolveBusinessPath(businessRoot, relativePath);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      if (onlyId && !content.includes(onlyId)) continue;
      for (const section of parseRuleSections(content)) {
        if (section.id && (!onlyId || section.id === onlyId)) found.push({ filePath, section });
      }
    }
  }
  return found;
}

function ruleReference(projectRoot, { filePath, section }) {
  const [status = null] = ruleStatuses(section);
  const affectedModules = ruleAffectedModules(section);
  return createKnowledgeReference({
    id: section.id,
    kind: "business-rule",
    source: dataRelative(projectRoot, filePath),
    address: `section:${section.id}`,
    provenance: PROVENANCE,
    status,
    relationships: affectedModules.length > 0 ? { affectedModules } : {}
  });
}

function resolveBusinessRule(projectRoot, id) {
  const found = collectRuleSections(projectRoot, id);
  if (found.length === 0) throw new Error(`Business rule not found: ${id}`);
  if (found.length > 1) throw new Error(`Duplicate business rule ID: ${id}`);
  return { reference: ruleReference(projectRoot, found[0]), text: found[0].section.raw };
}

// Content signature of the rule section only (never the path); trailing
// whitespace is ignored so moving the last section of a file does not change it.
function enumerateBusinessRules(projectRoot) {
  const seen = new Set();
  return collectRuleSections(projectRoot).map((entry) => {
    if (seen.has(entry.section.id)) throw new Error(`Duplicate business rule ID: ${entry.section.id}`);
    seen.add(entry.section.id);
    return { reference: ruleReference(projectRoot, entry), signature: sha256(entry.section.raw.trimEnd()) };
  });
}

const FEATURE_OBJECT_FAMILIES = [
  { kind: "functional-requirement", path: ["requirements", "functional"] },
  { kind: "non-functional-requirement", path: ["requirements", "nonFunctional"] },
  { kind: "acceptance-scenario", path: ["acceptance", "scenarios"] }
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Feature specs that declare a metadata.id, in directory order. A spec without
// one is not addressable.
function collectFeatureSpecs(projectRoot) {
  return getFeatureDirs(projectRoot)
    .map((dir) => getFeatureBundle(projectRoot, dir).featureSpecPath)
    .filter((specPath) => fs.existsSync(specPath))
    .map((specPath) => ({ specPath, spec: readYamlContract(specPath) }))
    .filter(({ spec }) => spec?.metadata?.id);
}

function* featureObjects(spec) {
  for (const family of FEATURE_OBJECT_FAMILIES) {
    const items = family.path.reduce((node, key) => node?.[key], spec);
    for (const object of Array.isArray(items) ? items : []) {
      if (object?.id !== undefined && object?.id !== null) yield { family, object };
    }
  }
}

function featureObjectReference(projectRoot, specPath, featureId, { family, object }) {
  const covers = Array.isArray(object.covers) ? object.covers : [];
  return createKnowledgeReference({
    id: `${featureId}#${object.id}`,
    kind: family.kind,
    source: dataRelative(projectRoot, specPath),
    address: `yaml:${family.path.join(".")}[id=${object.id}]`,
    provenance: PROVENANCE,
    relationships: covers.length > 0 ? { covers } : {}
  });
}

// `<feature-id>#<object-id>`: feature-local IDs (FR-2, AC-2) stay unchanged in
// the canonical YAML; the feature's metadata.id qualifies them here.
function resolveFeatureObject(projectRoot, qualifiedId) {
  const separator = String(qualifiedId).indexOf("#");
  const featureId = separator > 0 ? qualifiedId.slice(0, separator) : "";
  const localId = separator > 0 ? qualifiedId.slice(separator + 1) : "";
  if (!featureId || !localId) {
    throw new Error(`Feature object ID must be qualified as <feature-id>#<object-id>: ${qualifiedId}`);
  }

  const specs = collectFeatureSpecs(projectRoot).filter(({ spec }) => spec.metadata.id === featureId);
  if (specs.length === 0) throw new Error(`Feature not found: ${featureId}`);
  if (specs.length > 1) throw new Error(`Duplicate feature ID: ${featureId}`);

  const { specPath, spec } = specs[0];
  const matches = [...featureObjects(spec)].filter(({ object }) => object.id === localId);
  if (matches.length === 0) throw new Error(`Feature object not found: ${qualifiedId}`);
  if (matches.length > 1) throw new Error(`Duplicate feature object ID: ${qualifiedId}`);

  return { reference: featureObjectReference(projectRoot, specPath, featureId, matches[0]), object: matches[0].object };
}

// Signature is over the canonical object (key order ignored), never the path.
function enumerateFeatureObjects(projectRoot) {
  const entries = [];
  const featureIds = new Set();
  const objectIds = new Set();
  for (const { specPath, spec } of collectFeatureSpecs(projectRoot)) {
    const featureId = spec.metadata.id;
    if (featureIds.has(featureId)) throw new Error(`Duplicate feature ID: ${featureId}`);
    featureIds.add(featureId);
    for (const entry of featureObjects(spec)) {
      const reference = featureObjectReference(projectRoot, specPath, featureId, entry);
      if (objectIds.has(reference.id)) throw new Error(`Duplicate feature object ID: ${reference.id}`);
      objectIds.add(reference.id);
      entries.push({ reference, signature: sha256(JSON.stringify(sortKeysDeep(entry.object))) });
    }
  }
  return entries;
}

export { enumerateBusinessRules, enumerateFeatureObjects, resolveBusinessRule, resolveFeatureObject, sha256 };
