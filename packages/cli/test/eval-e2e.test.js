import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import YAML from "yaml";
import { initProject, spectra } from "./helpers/project.js";

function evalFiles(root) {
  const features = path.join(root, ".spectra", "sdd", "features");
  const featureId = fs.readdirSync(features)[0];
  const evalDir = path.join(features, featureId, "evals");
  return { featureId, evalDir };
}

function writeYaml(file, value) {
  fs.writeFileSync(file, YAML.stringify(value));
}

test("smoke eval fails when every selected scenario fails", () => {
  const root = initProject("full");
  const { featureId, evalDir } = evalFiles(root);
  const goldenPath = path.join(evalDir, "golden-scenarios.yaml");
  const golden = YAML.parse(fs.readFileSync(goldenPath, "utf8"));
  for (const scenario of golden.scenarios) {
    scenario.expected.telemetry_events = ["untracked-event"];
  }
  writeYaml(goldenPath, golden);

  const result = spectra(root, ["eval", featureId, "--suite", "smoke"]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /FAIL Eval suite failed \(0\/2\)/);
  const report = JSON.parse(fs.readFileSync(path.join(evalDir, "reports", "latest.json"), "utf8"));
  assert.equal(report.passed, false);
  assert.equal(report.totals.failed, 2);
});

test("command eval executes setup and fixtures, then compares real exit and output", () => {
  const root = initProject("full");
  const { featureId, evalDir } = evalFiles(root);
  const specialTemp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spectra-eval-parent-")), "eval space & %TEMP%");
  fs.mkdirSync(specialTemp);
  const tempEnv = { TMPDIR: specialTemp, TEMP: specialTemp, TMP: specialTemp };
  const suitePath = path.join(evalDir, "regression-suite.yaml");
  const suite = YAML.parse(fs.readFileSync(suitePath, "utf8"));
  suite.suites[0].scenario_ids = ["APP-001"];
  suite.suites[0].execution = { tool_mode: "command", setup: ["node setup.cjs"] };
  writeYaml(suitePath, suite);
  writeYaml(path.join(evalDir, "golden-scenarios.yaml"), {
    apiVersion: "spectra/v2",
    kind: "GoldenScenarios",
    feature_id: featureId,
    scenarios: [{
      id: "APP-001",
      title: "CLI reads fixture",
      category: "happy_path",
      severity: "critical",
      input: {
        command: "node app.cjs <case-fixture>",
        fixture: { files: [{ path: "input.txt", content: "new behavior\n" }] }
      },
      expected: { exit_code: 0, stdout: "new behavior\n", stderr: "", telemetry_events: ["not-declared"] }
    }]
  });
  fs.writeFileSync(path.join(root, "setup.cjs"), "require('node:fs').writeFileSync('ready', 'yes')\n");
  const appPath = path.join(root, "app.cjs");
  fs.writeFileSync(appPath, "process.stdout.write('old behavior\\n')\n");

  const failed = spectra(root, ["eval", featureId, "--suite", "smoke"], tempEnv);
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.equal(fs.readFileSync(path.join(root, "ready"), "utf8"), "yes");
  let report = JSON.parse(fs.readFileSync(path.join(evalDir, "reports", "latest.json"), "utf8"));
  assert.match(report.scenarios[0].reasons.join("; "), /stdout/);

  fs.writeFileSync(appPath, "process.stdout.write('new behavior\\n'); process.exitCode = 2\n");
  const wrongExit = spectra(root, ["eval", featureId, "--suite", "smoke"], tempEnv);
  assert.equal(wrongExit.status, 1, wrongExit.stdout + wrongExit.stderr);
  report = JSON.parse(fs.readFileSync(path.join(evalDir, "reports", "latest.json"), "utf8"));
  assert.match(report.scenarios[0].reasons.join("; "), /exit code 2 != 0/);

  fs.writeFileSync(appPath, "process.stdout.write(require('node:fs').readFileSync(require('node:path').join(process.argv[2], 'input.txt')))\n");
  const passed = spectra(root, ["eval", featureId, "--suite", "smoke"], tempEnv);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  report = JSON.parse(fs.readFileSync(path.join(evalDir, "reports", "latest.json"), "utf8"));
  assert.equal(report.totals.passed, 1);

  const goldenPath = path.join(evalDir, "golden-scenarios.yaml");
  const golden = YAML.parse(fs.readFileSync(goldenPath, "utf8"));
  golden.scenarios[0].input.command = "node app.cjs <typo-fixture>";
  writeYaml(goldenPath, golden);
  const unknownFixture = spectra(root, ["eval", featureId, "--suite", "smoke"], tempEnv);
  assert.equal(unknownFixture.status, 1, unknownFixture.stdout + unknownFixture.stderr);
  report = JSON.parse(fs.readFileSync(path.join(evalDir, "reports", "latest.json"), "utf8"));
  assert.match(report.scenarios[0].reasons.join("; "), /unsupported fixture placeholder <typo-fixture>/);

  golden.scenarios[0].input.command = "node app.cjs <case-fixutre>";
  writeYaml(goldenPath, golden);
  const misspelledFixture = spectra(root, ["eval", featureId, "--suite", "smoke"], tempEnv);
  assert.equal(misspelledFixture.status, 1, misspelledFixture.stdout + misspelledFixture.stderr);
  report = JSON.parse(fs.readFileSync(path.join(evalDir, "reports", "latest.json"), "utf8"));
  assert.match(report.scenarios[0].reasons.join("; "), /fixture files require input.command to include <case-fixture>/);
});
