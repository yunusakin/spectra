import fs from "node:fs";
import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { parseRuleSections, ruleAffectedModules, ruleStatuses } from "../business/rule-sections.js";
import { readBusinessIndexes, resolveBusinessPath } from "../business/repository.js";
import { rowValue } from "../business/parser.js";
import { getFeatureBundle, getFeatureDirs } from "../specs/feature-bundles.js";
import { readYamlContract, toPosix } from "../specs/primitives.js";
import { createKnowledgeReference } from "./reference.js";

const PROVENANCE = "human-declared";

// Paths are reported like the context pack does: relative to the data root
// (`sdd/memory-bank/...`), independent of the project layout.
function dataRelative(projectRoot, absolutePath) {
  return toPosix(path.relative(path.dirname(getSddRoot(projectRoot)), absolutePath));
}

function resolveBusinessRule(projectRoot, id) {
  const { businessRoot, domainRows } = readBusinessIndexes(projectRoot);
  const found = [];
  for (const row of domainRows) {
    for (const relativePath of [rowValue(row, "rules"), rowValue(row, "unresolved")].filter(Boolean)) {
      const filePath = resolveBusinessPath(businessRoot, relativePath);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      if (!content.includes(id)) continue;
      for (const section of parseRuleSections(content)) {
        if (section.id === id) found.push({ filePath, section });
      }
    }
  }
  if (found.length === 0) throw new Error(`Business rule not found: ${id}`);
  if (found.length > 1) throw new Error(`Duplicate business rule ID: ${id}`);

  const { filePath, section } = found[0];
  const [status = null] = ruleStatuses(section);
  const affectedModules = ruleAffectedModules(section);
  return {
    reference: createKnowledgeReference({
      id,
      kind: "business-rule",
      source: dataRelative(projectRoot, filePath),
      address: `section:${id}`,
      provenance: PROVENANCE,
      status,
      relationships: affectedModules.length > 0 ? { affectedModules } : {}
    }),
    text: section.raw
  };
}

const FEATURE_OBJECT_FAMILIES = [
  { kind: "functional-requirement", path: ["requirements", "functional"] },
  { kind: "non-functional-requirement", path: ["requirements", "nonFunctional"] },
  { kind: "acceptance-scenario", path: ["acceptance", "scenarios"] }
];

// `<feature-id>#<object-id>`: feature-local IDs (FR-2, AC-2) stay unchanged in
// the canonical YAML; the feature's metadata.id qualifies them here.
function resolveFeatureObject(projectRoot, qualifiedId) {
  const separator = String(qualifiedId).indexOf("#");
  const featureId = separator > 0 ? qualifiedId.slice(0, separator) : "";
  const localId = separator > 0 ? qualifiedId.slice(separator + 1) : "";
  if (!featureId || !localId) {
    throw new Error(`Feature object ID must be qualified as <feature-id>#<object-id>: ${qualifiedId}`);
  }

  const specs = getFeatureDirs(projectRoot)
    .map((dir) => getFeatureBundle(projectRoot, dir).featureSpecPath)
    .filter((specPath) => fs.existsSync(specPath))
    .map((specPath) => ({ specPath, spec: readYamlContract(specPath) }))
    .filter(({ spec }) => spec?.metadata?.id === featureId);
  if (specs.length === 0) throw new Error(`Feature not found: ${featureId}`);
  if (specs.length > 1) throw new Error(`Duplicate feature ID: ${featureId}`);

  const { specPath, spec } = specs[0];
  const matches = [];
  for (const family of FEATURE_OBJECT_FAMILIES) {
    const items = family.path.reduce((node, key) => node?.[key], spec);
    for (const object of Array.isArray(items) ? items : []) {
      if (object?.id === localId) matches.push({ family, object });
    }
  }
  if (matches.length === 0) throw new Error(`Feature object not found: ${qualifiedId}`);
  if (matches.length > 1) throw new Error(`Duplicate feature object ID: ${qualifiedId}`);

  const { family, object } = matches[0];
  const covers = Array.isArray(object.covers) ? object.covers : [];
  return {
    reference: createKnowledgeReference({
      id: qualifiedId,
      kind: family.kind,
      source: dataRelative(projectRoot, specPath),
      address: `yaml:${family.path.join(".")}[id=${localId}]`,
      provenance: PROVENANCE,
      relationships: covers.length > 0 ? { covers } : {}
    }),
    object
  };
}

export { resolveBusinessRule, resolveFeatureObject };
