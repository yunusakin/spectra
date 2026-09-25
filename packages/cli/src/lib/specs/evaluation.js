import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

function runCommand(command, cwd, env = process.env) {
  return spawnSync(command, { cwd, env, shell: true, encoding: "utf8", timeout: 60_000, maxBuffer: 1024 * 1024 });
}

function evaluateCommandScenario(repoRoot, scenario, result, setupError) {
  if (setupError) {
    result.reasons.push(`suite setup failed: ${setupError}`);
    result.passed = false;
    return result;
  }
  if (typeof scenario.input?.command !== "string" || !scenario.input.command.trim()) {
    result.reasons.push("command mode requires input.command");
    result.passed = false;
    return result;
  }
  const fixturePlaceholders = scenario.input.command.match(/<[^<>]*-fixture>/g) ?? [];
  const unsupportedFixture = fixturePlaceholders.find((placeholder) => placeholder !== "<case-fixture>");
  if (unsupportedFixture) {
    result.reasons.push(`unsupported fixture placeholder ${unsupportedFixture}`);
    result.passed = false;
    return result;
  }
  if (scenario.input.fixture && !scenario.input.command.includes("<case-fixture>")) {
    result.reasons.push("fixture files require input.command to include <case-fixture>");
    result.passed = false;
    return result;
  }

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spectra-eval-"));
  try {
    for (const file of scenario.input.fixture?.files ?? []) {
      const target = path.resolve(fixtureRoot, file.path ?? "");
      if (!file.path || !target.startsWith(`${fixtureRoot}${path.sep}`)) {
        throw new Error(`invalid fixture path: ${file.path}`);
      }
      ensureDirectory(path.dirname(target));
      fs.writeFileSync(target, file.content ?? "");
    }
    const fixtureVariable = process.platform === "win32"
      ? '"%SPECTRA_EVAL_FIXTURE_ROOT%"'
      : '"$SPECTRA_EVAL_FIXTURE_ROOT"';
    const command = scenario.input.command.replaceAll("<case-fixture>", fixtureVariable);
    const actual = runCommand(command, repoRoot, { ...process.env, SPECTRA_EVAL_FIXTURE_ROOT: fixtureRoot });
    if (actual.error) result.reasons.push(`command failed: ${actual.error.message}`);
    const expected = scenario.expected ?? {};
    if (typeof expected.exit_code !== "number") result.reasons.push("command mode requires expected.exit_code");
    else if (actual.status !== expected.exit_code) result.reasons.push(`exit code ${actual.status} != ${expected.exit_code}`);
    for (const stream of ["stdout", "stderr"]) {
      if (typeof expected[stream] === "string" && actual[stream] !== expected[stream]) {
        result.reasons.push(`${stream} did not match expected output`);
      }
      for (const fragment of expected[`${stream}_contains`] ?? []) {
        if (!actual[stream]?.includes(fragment)) result.reasons.push(`${stream} missing ${JSON.stringify(fragment)}`);
      }
    }
  } catch (error) {
    result.reasons.push(`command evaluation failed: ${error.message}`);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
  result.passed = result.passed && result.reasons.length === 0;
  return result;
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
    const suite = regressionSuite.suites.find((candidate) => candidate.id === suiteId);
    const mode = suite.execution?.tool_mode ?? "contract";
    if (mode !== "contract" && mode !== "command") throw new Error(`Unsupported eval tool mode: ${mode}`);
    let setupError = null;
    if (mode === "command" && scenarios.length) {
      for (const command of suite.execution?.setup ?? []) {
        const run = runCommand(command, repoRoot);
        if (run.error || run.status !== 0) {
          setupError = run.error?.message ?? `exit ${run.status}: ${run.stderr?.trim() || command}`;
          break;
        }
      }
    }
    const results = scenarios.map((scenario) => {
      if (mode === "command") {
        return evaluateCommandScenario(repoRoot, scenario, {
          scenario_id: scenario.id,
          title: scenario.title,
          category: scenario.category,
          severity: scenario.severity,
          passed: true,
          reasons: []
        }, setupError);
      }
      return evaluateScenario(scenario, featureSpec, behaviorSpec, telemetryContract, failureModes);
    });
    const passed = results.filter((result) => result.passed).length;
    const totals = {
      scenarios: results.length,
      passed,
      failed: results.length - passed,
      pass_rate: results.length === 0 ? 0 : passed / results.length
    };

    const requiredOverall =
      suiteId === "release" ? evalThresholds?.thresholds?.overall_pass_rate ?? 0.98 : 1;
    const featureReport = {
      feature_id: featureSpec?.metadata?.id ?? path.basename(featureDir),
      totals,
      release_threshold: requiredOverall,
      passed: totals.scenarios > 0 && totals.pass_rate >= requiredOverall,
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
