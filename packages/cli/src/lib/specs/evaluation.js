import fs from "node:fs";
import path from "node:path";
import { ensureDirectory } from "../runtime.js";
import { getFeatureBundle, getFeatureDirs, listRequirementIds } from "./feature-bundles.js";
import { readJsonContract } from "./primitives.js";

function buildEvalSelection(regressionSuite, goldenScenarios, suiteId) {
  const suite = (regressionSuite?.suites ?? []).find((candidate) => candidate.id === suiteId);
  if (!suite) {
    throw new Error(`Unknown eval suite: ${suiteId}`);
  }

  const scenarios = goldenScenarios?.scenarios ?? [];
  if (suite.scenario_ids?.length) {
    return scenarios.filter((scenario) => suite.scenario_ids.includes(scenario.id));
  }

  return scenarios.filter((scenario) => {
    const categoryOk =
      !suite.include_categories?.length || suite.include_categories.includes(scenario.category);
    const severityOk =
      !suite.include_severities?.length || suite.include_severities.includes(scenario.severity);
    return categoryOk && severityOk;
  });
}

function evaluateScenario(scenario, featureSpec, behaviorSpec, telemetryContract, failureModes) {
  let passed = true;
  const reasons = [];
  const category = scenario.category;
  const trackedEvents = new Set((telemetryContract?.tracked_events ?? []).map((event) => event.name));

  if (category === "happy_path" && (featureSpec?.requirements?.functional ?? []).length === 0) {
    passed = false;
    reasons.push("feature has no functional requirements");
  }

  if (category === "refusal_cases" && (behaviorSpec?.refusal_policy?.refuse_when ?? []).length === 0) {
    passed = false;
    reasons.push("refusal policy is undefined");
  }

  if (category === "tool_failure_cases") {
    const hasFailureAwareTool = (behaviorSpec?.tool_contracts ?? []).some(
      (contract) => (contract.failure_modes ?? []).length > 0
    );
    if (!hasFailureAwareTool || !(behaviorSpec?.fallback_behavior?.strategy_order ?? []).length) {
      passed = false;
      reasons.push("tool failure behavior is incomplete");
    }
  }

  if (category === "unsafe_behavior_cases") {
    if ((behaviorSpec?.disallowed_actions ?? []).length === 0) {
      passed = false;
      reasons.push("unsafe behavior guardrails are undefined");
    }
  }

  for (const expectedEvent of scenario?.expected?.telemetry_events ?? []) {
    if (!trackedEvents.has(expectedEvent)) {
      passed = false;
      reasons.push(`missing telemetry event ${expectedEvent}`);
    }
  }

  if (category === "edge_cases" && (failureModes?.failure_modes ?? []).length === 0) {
    passed = false;
    reasons.push("failure modes are undefined");
  }

  return {
    scenario_id: scenario.id,
    title: scenario.title,
    category,
    severity: scenario.severity,
    passed,
    reasons
  };
}

function runEvalSuite(repoRoot, { featureId = null, suiteId = "smoke" } = {}) {
  const featureDirs = getFeatureDirs(repoRoot);
  const selectedDirs = featureId
    ? featureDirs.filter((featureDir) => path.basename(featureDir) === featureId)
    : featureDirs;

  if (selectedDirs.length === 0) {
    throw new Error(featureId ? `Unknown feature id: ${featureId}` : "No feature bundles found for evals.");
  }

  const report = {
    generated_at: new Date().toISOString(),
    suite: suiteId,
    features: [],
    totals: {
      scenarios: 0,
      passed: 0,
      failed: 0
    }
  };

  for (const featureDir of selectedDirs) {
    const paths = getFeatureBundle(repoRoot, featureDir);
    const featureSpec = readJsonContract(paths.featureSpecPath);
    const behaviorSpec = readJsonContract(paths.behaviorSpecPath);
    const telemetryContract = readJsonContract(paths.telemetryContractPath);
    const goldenScenarios = readJsonContract(paths.goldenScenariosPath);
    const regressionSuite = readJsonContract(paths.regressionSuitePath);
    const failureModes = readJsonContract(paths.failureModesPath);
    const evalThresholds = readJsonContract(paths.evalThresholdsPath);
    const scenarios = buildEvalSelection(regressionSuite, goldenScenarios, suiteId);
    const results = scenarios.map((scenario) =>
      evaluateScenario(scenario, featureSpec, behaviorSpec, telemetryContract, failureModes)
    );
    const passed = results.filter((result) => result.passed).length;
    const totals = {
      scenarios: results.length,
      passed,
      failed: results.length - passed,
      pass_rate: results.length === 0 ? 0 : passed / results.length
    };

    const requiredOverall =
      suiteId === "release" ? evalThresholds?.thresholds?.overall_pass_rate ?? 0.98 : 0;
    const featureReport = {
      feature_id: featureSpec?.metadata?.id ?? path.basename(featureDir),
      totals,
      release_threshold: requiredOverall,
      passed: totals.pass_rate >= requiredOverall,
      scenarios: results
    };

    report.features.push(featureReport);
    report.totals.scenarios += totals.scenarios;
    report.totals.passed += totals.passed;
    report.totals.failed += totals.failed;

    ensureDirectory(path.join(paths.evalDir, "reports"));
    fs.writeFileSync(
      path.join(paths.evalDir, "reports", "latest.json"),
      `${JSON.stringify(featureReport, null, 2)}\n`
    );
    fs.writeFileSync(
      path.join(paths.evalDir, "reports", "latest.md"),
      [
        `# Eval Report`,
        ``,
        `- Feature: ${featureReport.feature_id}`,
        `- Suite: ${suiteId}`,
        `- Pass Rate: ${totals.pass_rate.toFixed(2)}`,
        `- Passed: ${totals.passed}/${totals.scenarios}`,
        ``,
        `## Scenario Results`,
        ...results.map((result) =>
          `- ${result.passed ? "OK" : "FAIL"} ${result.scenario_id} (${result.category})${result.reasons.length ? `: ${result.reasons.join("; ")}` : ""}`
        )
      ].join("\n")
    );
  }

  report.totals.pass_rate =
    report.totals.scenarios === 0 ? 0 : report.totals.passed / report.totals.scenarios;
  report.passed = report.features.every((feature) => feature.passed);

  return report;
}


export { buildEvalSelection, evaluateScenario, runEvalSuite };
