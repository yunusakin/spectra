import fs from "node:fs";
import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { STAGES } from "./stages.js";
import { getFeatureBundle, getFeatureDirs, listRequirementIds } from "./feature-bundles.js";
import { hasRealMarkdownContent, readJsonContract, toPosix } from "./primitives.js";

function validateFeatureBundle(bundlePaths) {
  const errors = [];
  const warnings = [];
  const featureSpec = readJsonContract(bundlePaths.featureSpecPath);
  const technicalDecisions = readJsonContract(bundlePaths.technicalDecisionsPath);
  const behaviorSpec = readJsonContract(bundlePaths.behaviorSpecPath);
  const telemetryContract = readJsonContract(bundlePaths.telemetryContractPath);
  const releaseThresholds = readJsonContract(bundlePaths.releaseThresholdsPath);
  const evalThresholds = readJsonContract(bundlePaths.evalThresholdsPath);
  const goldenScenarios = readJsonContract(bundlePaths.goldenScenariosPath);
  const regressionSuite = readJsonContract(bundlePaths.regressionSuitePath);
  const failureModes = readJsonContract(bundlePaths.failureModesPath);

  for (const [label, filePath] of [
    ["feature spec", bundlePaths.featureSpecPath],
    ["technical decisions", bundlePaths.technicalDecisionsPath],
    ["AI behavior spec", bundlePaths.behaviorSpecPath],
    ["telemetry contract", bundlePaths.telemetryContractPath],
    ["release thresholds", bundlePaths.releaseThresholdsPath],
    ["eval thresholds", bundlePaths.evalThresholdsPath],
    ["golden scenarios", bundlePaths.goldenScenariosPath],
    ["regression suite", bundlePaths.regressionSuitePath],
    ["failure modes", bundlePaths.failureModesPath]
  ]) {
    if (!fs.existsSync(filePath)) {
      errors.push(`${label} is missing: ${path.relative(process.cwd(), filePath)}`);
    }
  }

  if (!featureSpec || !featureSpec.metadata?.id) {
    errors.push(`${bundlePaths.featureSpecPath}: missing metadata.id`);
    return { errors, warnings };
  }

  const featureId = featureSpec.metadata.id;
  const requirementIds = new Set(listRequirementIds(featureSpec));
  const telemetryRequirementIds = [
    ...(telemetryContract?.tracked_events ?? []).flatMap((event) => event.requirement_ids ?? []),
    ...(telemetryContract?.success_signals ?? []).flatMap((signal) => signal.requirement_ids ?? []),
    ...(telemetryContract?.failure_signals ?? []).flatMap((signal) => signal.requirement_ids ?? [])
  ];

  for (const contract of [
    ["technical decisions", technicalDecisions],
    ["AI behavior spec", behaviorSpec],
    ["telemetry contract", telemetryContract],
    ["release thresholds", releaseThresholds],
    ["eval thresholds", evalThresholds],
    ["golden scenarios", goldenScenarios],
    ["regression suite", regressionSuite],
    ["failure modes", failureModes]
  ]) {
    const [label, value] = contract;
    if (value?.feature_id && value.feature_id !== featureId) {
      errors.push(`${label}: feature_id does not match ${featureId}`);
    }
  }

  for (const requirementId of telemetryRequirementIds) {
    if (!requirementIds.has(requirementId)) {
      errors.push(`${bundlePaths.telemetryContractPath}: unknown requirement id ${requirementId}`);
    }
  }

  const scenarioIds = new Set((goldenScenarios?.scenarios ?? []).map((scenario) => scenario.id));
  for (const suite of regressionSuite?.suites ?? []) {
    for (const scenarioId of suite.scenario_ids ?? []) {
      if (!scenarioIds.has(scenarioId)) {
        errors.push(`${bundlePaths.regressionSuitePath}: suite ${suite.id} references unknown scenario ${scenarioId}`);
      }
    }
  }

  for (const failureMode of failureModes?.failure_modes ?? []) {
    for (const scenarioId of failureMode.covered_by ?? []) {
      if (!scenarioIds.has(scenarioId)) {
        errors.push(`${bundlePaths.failureModesPath}: failure mode ${failureMode.id} references unknown scenario ${scenarioId}`);
      }
    }
  }

  const telemetrySignalIds = new Set([
    ...(telemetryContract?.success_signals ?? []).map((signal) => signal.id),
    ...(telemetryContract?.failure_signals ?? []).map((signal) => signal.id)
  ]);

  for (const signalId of releaseThresholds?.gates?.telemetry?.required_signals ?? []) {
    if (!telemetrySignalIds.has(signalId)) {
      errors.push(`${bundlePaths.releaseThresholdsPath}: required telemetry signal ${signalId} is undefined`);
    }
  }

  const suiteIds = new Set((regressionSuite?.suites ?? []).map((suite) => suite.id));
  if (!suiteIds.has(releaseThresholds?.gates?.evals?.required_suite)) {
    errors.push(`${bundlePaths.releaseThresholdsPath}: eval suite ${releaseThresholds?.gates?.evals?.required_suite} is undefined`);
  }

  if (!suiteIds.has(evalThresholds?.required_suite)) {
    errors.push(`${bundlePaths.evalThresholdsPath}: required_suite ${evalThresholds?.required_suite} is undefined`);
  }

  if ((behaviorSpec?.tool_contracts ?? []).some((contract) => /create|write|update/i.test(contract.name ?? ""))) {
    if ((behaviorSpec?.human_review_points ?? []).length === 0) {
      warnings.push(`${bundlePaths.behaviorSpecPath}: write-capable tool contracts should define human_review_points`);
    }
  }

  if (!hasRealMarkdownContent(bundlePaths.briefPath)) {
    warnings.push(`${bundlePaths.briefPath}: narrative brief is still template-level`);
  }

  return { errors, warnings };
}

function validateSpectraV2(repoRoot) {
  const errors = [];
  const warnings = [];

  const sddRoot = getSddRoot(repoRoot);
  const approvalStatePath = path.join(sddRoot, "governance", "approval-state.yaml");
  const decisionGraphPath = path.join(sddRoot, "governance", "decision-graph.yaml");

  if (!fs.existsSync(approvalStatePath)) {
    errors.push(`Missing ${toPosix(path.relative(repoRoot, approvalStatePath))}`);
  }
  if (!fs.existsSync(decisionGraphPath)) {
    errors.push(`Missing ${toPosix(path.relative(repoRoot, decisionGraphPath))}`);
  }

  if (fs.existsSync(approvalStatePath)) {
    const state = readJsonContract(approvalStatePath);
    if (!STAGES.includes(state?.current_state)) {
      errors.push(`${approvalStatePath}: invalid current_state`);
    }
    if (!STAGES.includes(state?.highest_valid_state)) {
      errors.push(`${approvalStatePath}: invalid highest_valid_state`);
    }
  }

  const featureDirs = getFeatureDirs(repoRoot);
  if (featureDirs.length === 0) {
    warnings.push("No feature bundles found under sdd/features/");
  }

  for (const featureDir of featureDirs) {
    const result = validateFeatureBundle(getFeatureBundle(repoRoot, featureDir));
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    featureDirs
  };
}


export { validateFeatureBundle, validateSpectraV2 };
