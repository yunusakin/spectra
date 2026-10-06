import fs from "node:fs";
import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { buildFeatureBundle } from "./bundle-defaults/index.js";
import { isDeepStrictEqual } from "node:util";
import YAML from "yaml";
import { ensureFile, readJsonContract, writeJsonContract } from "./primitives.js";


function ensureV2Scaffolding(targetRoot, { adopt = false, preserveExisting = false, starterBundle = true } = {}) {
  const projectName = path.basename(path.resolve(targetRoot));
  const bundle = buildFeatureBundle(projectName);
  const sddRoot = getSddRoot(targetRoot);
  const featureDir = path.join(sddRoot, "features", bundle.featureId);
  const evalDir = path.join(featureDir, "evals");
  const writeContract = (file, contract) => {
    if (!preserveExisting || !fs.existsSync(file)) writeJsonContract(file, contract);
  };

  // The starter feature is first-install scaffolding for a project that has no feature yet; once a project is
  // installed it belongs to the user, who may rename, rewrite or delete it.
  if (starterBundle) {
    writeContract(path.join(featureDir, "feature.spec.yaml"), bundle.featureSpec);
    writeContract(path.join(featureDir, "technical-decisions.yaml"), bundle.technicalDecisions);
    writeContract(path.join(featureDir, "ai-behavior-spec.yaml"), bundle.behaviorSpec);
    writeContract(path.join(featureDir, "telemetry-contract.yaml"), bundle.telemetryContract);
    writeContract(path.join(featureDir, "release-thresholds.yaml"), bundle.releaseThresholds);
    writeContract(path.join(evalDir, "release-thresholds.yaml"), bundle.evalThresholds);
    writeContract(path.join(evalDir, "golden-scenarios.yaml"), bundle.goldenScenarios);
    writeContract(path.join(evalDir, "regression-suite.yaml"), bundle.regressionSuite);
    writeContract(path.join(evalDir, "failure-modes.yaml"), bundle.failureModes);
    ensureFile(path.join(featureDir, "brief.md"), bundle.briefMarkdown);
    ensureFile(path.join(featureDir, "release-checklist.md"), bundle.releaseChecklistMarkdown);

  }

  writeContract(path.join(sddRoot, "governance", "approval-state.yaml"), bundle.approvalState);
  writeContract(path.join(sddRoot, "governance", "decision-graph.yaml"), bundle.decisionGraph);

  if (adopt) {
    writeContract(path.join(sddRoot, "adoption", "current-state.summary.yaml"), bundle.adoption.currentState);
    writeContract(path.join(sddRoot, "adoption", "gap-analysis.yaml"), bundle.adoption.gapAnalysis);
    writeContract(path.join(sddRoot, "adoption", "review-queue.yaml"), bundle.adoption.reviewQueue);
  }
}

function getFeatureDirs(repoRoot) {
  const featuresRoot = path.join(getSddRoot(repoRoot), "features");
  if (!fs.existsSync(featuresRoot)) {
    return [];
  }

  return fs
    .readdirSync(featuresRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(featuresRoot, entry.name))
    .sort();
}

// The starter bundle Spectra scaffolds on first install is a placeholder for the user's own feature. While its spec is
// still byte-for-byte what the template generates it describes no consumer behavior: it must not count as a product
// feature in adoption analysis or block release readiness. Editing it (or adding any other feature) makes it real,
// which also keeps Spectra's own repository safe: its spectra-core spec differs from the template.
const STARTER_PROJECT_NAME = ".spectra"; // the data-root folder name the starter is generated under in every installed project

function isUnmodifiedStarter(repoRoot, featureDir) {
  const bundle = buildFeatureBundle(STARTER_PROJECT_NAME);
  if (path.basename(featureDir) !== bundle.featureId) return false;
  let current;
  try {
    current = readJsonContract(path.join(featureDir, "feature.spec.yaml"), null);
  } catch {
    return false;
  }
  return current !== null && isDeepStrictEqual(current, YAML.parse(YAML.stringify(bundle.featureSpec)));
}

function getConsumerFeatureDirs(repoRoot) {
  return getFeatureDirs(repoRoot).filter((featureDir) => !isUnmodifiedStarter(repoRoot, featureDir));
}

function getFeatureBundle(repoRoot, featureDir) {
  return {
    dir: featureDir,
    featureSpecPath: path.join(featureDir, "feature.spec.yaml"),
    technicalDecisionsPath: path.join(featureDir, "technical-decisions.yaml"),
    behaviorSpecPath: path.join(featureDir, "ai-behavior-spec.yaml"),
    telemetryContractPath: path.join(featureDir, "telemetry-contract.yaml"),
    releaseThresholdsPath: path.join(featureDir, "release-thresholds.yaml"),
    briefPath: path.join(featureDir, "brief.md"),
    releaseChecklistPath: path.join(featureDir, "release-checklist.md"),
    evalDir: path.join(featureDir, "evals"),
    evalThresholdsPath: path.join(featureDir, "evals", "release-thresholds.yaml"),
    goldenScenariosPath: path.join(featureDir, "evals", "golden-scenarios.yaml"),
    regressionSuitePath: path.join(featureDir, "evals", "regression-suite.yaml"),
    failureModesPath: path.join(featureDir, "evals", "failure-modes.yaml")
  };
}

function listRequirementIds(featureSpec) {
  return [
    ...(featureSpec?.requirements?.functional ?? []).map((item) => item.id),
    ...(featureSpec?.requirements?.nonFunctional ?? []).map((item) => item.id)
  ];
}


export { buildFeatureBundle, ensureV2Scaffolding, getConsumerFeatureDirs, getFeatureBundle, getFeatureDirs, isUnmodifiedStarter, listRequirementIds };
