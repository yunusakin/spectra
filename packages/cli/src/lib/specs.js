import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ensureDirectory, findSpectraRoot } from "@spectra/core";
import YAML from "yaml";

const STAGES = [
  "draft",
  "product-approved",
  "technical-approved",
  "implementation-approved",
  "release-approved"
];

const CATEGORY_PRECEDENCE = [
  "scope increase",
  "contract break",
  "behavior change",
  "observability-only",
  "infra-only",
  "copy-only"
];

const STAGE_INVALIDATION = {
  "product-approved": new Set(["scope increase"]),
  "technical-approved": new Set(["scope increase", "contract break"]),
  "implementation-approved": new Set(["scope increase", "contract break", "behavior change"]),
  "release-approved": new Set([
    "scope increase",
    "contract break",
    "behavior change",
    "observability-only",
    "infra-only"
  ])
};

function slugify(value) {
  return String(value ?? "project-core")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "project-core";
}

function writeYamlContract(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(
    filePath,
    YAML.stringify(payload, {
      indent: 2,
      lineWidth: 0,
      defaultStringType: "PLAIN"
    })
  );
}

function readYamlContract(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return YAML.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid YAML in ${filePath}: ${error.message}`);
  }
}

function writeJsonContract(filePath, payload) {
  writeYamlContract(filePath, payload);
}

function readJsonContract(filePath, fallback = null) {
  return readYamlContract(filePath, fallback);
}

function readMarkdown(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function hasRealMarkdownContent(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return readMarkdown(filePath)
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith(">") &&
        !/^[-*]?\s*<[^>]+>$/.test(line) &&
        !/^`?<[^>]+>`?$/.test(line) &&
        !/filled by|filled before/i.test(line)
    );
}

function isGitRepo(repoRoot) {
  return (
    spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: repoRoot,
      stdio: "ignore"
    }).status === 0
  );
}

function getCurrentCommit(repoRoot) {
  if (!isGitRepo(repoRoot)) {
    return null;
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return result.status === 0 ? result.stdout.trim() : null;
}

function collectGitDiff(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getChangedFiles(repoRoot, { base = null, head = null, includeWorktree = true } = {}) {
  if (!isGitRepo(repoRoot)) {
    return [];
  }

  const seen = new Set();
  const addFiles = (files) => {
    for (const file of files) {
      seen.add(file);
    }
  };

  if (base) {
    addFiles(collectGitDiff(repoRoot, ["diff", "--name-only", base, head ?? "HEAD"]));
  }

  if (includeWorktree || !base) {
    addFiles(collectGitDiff(repoRoot, ["diff", "--name-only", "HEAD"]));
    addFiles(collectGitDiff(repoRoot, ["diff", "--cached", "--name-only"]));
    addFiles(collectGitDiff(repoRoot, ["ls-files", "--others", "--exclude-standard"]));
  }

  return [...seen].sort();
}

function ensureFile(filePath, content, { overwrite = false } = {}) {
  if (!overwrite && fs.existsSync(filePath)) {
    return;
  }

  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function buildFeatureBundle(projectName) {
  const featureId = `${slugify(projectName)}-core`;
  const safeProjectName = projectName || "Spectra Project";

  return {
    featureId,
    featureSpec: {
      apiVersion: "spectra/v2",
      kind: "FeatureSpec",
      metadata: {
        id: featureId,
        name: `${safeProjectName} Core Flow`,
        version: "0.1.0",
        owner: "product",
        status: "draft"
      },
      summary: {
        problem: "Users need a controlled way to define, implement, and verify work with AI assistance.",
        outcome: "The product can move from intent to validated implementation under explicit approval gates."
      },
      scope: {
        in: [
          "spec-driven planning",
          "approval-aware implementation",
          "verification and release confidence"
        ],
        out: ["live production telemetry ingestion", "fully autonomous remediation"]
      },
      requirements: {
        functional: [
          {
            id: "FR-1",
            statement: "Users can define product intent and technical decisions before implementation begins.",
            priority: "must"
          },
          {
            id: "FR-2",
            statement: "AI-assisted implementation is blocked until implementation approval is granted.",
            priority: "must"
          }
        ],
        nonFunctional: [
          {
            id: "NFR-1",
            statement: "Verification must aggregate validation, policy, tests, evals, telemetry, and release readiness.",
            priority: "must"
          }
        ]
      },
      acceptance: {
        scenarios: [
          {
            id: "AC-1",
            covers: ["FR-1"],
            given: "A new repository is initialized with Spectra",
            when: "A planner runs intake and defines the project",
            then: "Executable specs and approval state are created"
          },
          {
            id: "AC-2",
            covers: ["FR-2"],
            given: "Implementation approval has not been granted",
            when: "An agent attempts to start implementation",
            then: "Policy and approval checks block the work"
          }
        ]
      },
      dependencies: ["sdd/memory-bank/core/projectbrief.md", "sdd/governance/approval-state.yaml"]
    },
    technicalDecisions: {
      apiVersion: "spectra/v2",
      kind: "TechnicalDecisions",
      feature_id: featureId,
      architecture_style: "repo-native CLI orchestrating a packaged shell runtime",
      system_boundaries: [
        "CLI layer owns UX and orchestration",
        "packaged runtime owns deterministic shell workflows",
        "feature bundle owns executable specs and quality contracts"
      ],
      data_and_state: [
        "approval state and summaries are stored in repo-local files",
        "generated cache lives under .spectra/cache"
      ],
      constraints: [
        "Node CLI must work without network access",
        "shell runtime remains internal to the product"
      ]
    },
    behaviorSpec: {
      apiVersion: "spectra/v2",
      kind: "AIBehaviorSpec",
      metadata: {
        id: `${featureId}-ai`,
        name: `${safeProjectName} AI Behavior`,
        version: "0.1.0",
        owner: "eng-platform",
        status: "draft"
      },
      feature_id: featureId,
      objective: {
        user_outcome: "Guide the team from intent to verified delivery with minimal ambiguity.",
        completion_definition: "Specs are defined, approvals are current, and verification passes.",
        success_criteria: [
          "No implementation work starts before implementation approval",
          "Verification produces a release confidence summary"
        ]
      },
      model_dependencies: {
        primary_model: {
          provider: "openai",
          model: "gpt-5",
          min_version: "stable"
        },
        fallback_models: [
          {
            provider: "openai",
            model: "gpt-5-mini",
            min_version: "stable"
          }
        ],
        required_capabilities: ["structured_output", "tool_use", "long_context"]
      },
      tool_contracts: [
        {
          name: "spectra.context_pack",
          purpose: "Resolve the minimum required context for a role and goal.",
          allowed_when: "A role and goal are known",
          required_inputs: ["role", "goal"],
          optional_inputs: ["base", "head"],
          output_contract: ["ordered refs or inline summaries"],
          failure_modes: ["missing_runtime", "invalid_role", "invalid_goal"],
          on_failure: "escalate"
        }
      ],
      allowed_actions: [
        "read compact summaries before raw markdown",
        "propose clarifying questions",
        "update specs and generated reports"
      ],
      disallowed_actions: [
        "write application code before implementation approval",
        "bypass validation or verify",
        "invent missing approvals"
      ],
      confidence_policy: {
        min_answer_confidence: 0.75,
        min_action_confidence: 0.8,
        min_write_confidence: 0.9,
        below_threshold_behavior: "ask_followup"
      },
      fallback_behavior: {
        strategy_order: ["ask_targeted_followup", "use_summary_only_mode", "escalate_to_human"],
        max_followup_rounds: 3,
        max_tool_retries: 1,
        preserve_partial_state: true
      },
      escalation_rules: [
        {
          when: "approval state is invalid for the requested action",
          action: "ask_human",
          severity: "high",
          owner: "engineering"
        }
      ],
      human_review_points: [
        {
          stage: "implementation_approval",
          required_when: "app code or externally visible behavior is about to change",
          reviewer_role: "engineering",
          decision_required: "approve"
        }
      ],
      refusal_policy: {
        refuse_when: [
          "user requests implementation before implementation-approved",
          "user requests release before release-approved"
        ],
        refusal_style: "brief_with_reason",
        safe_alternatives: [
          "run spectra validate",
          "run spectra approve --stage implementation-approved",
          "run spectra verify --profile release"
        ]
      },
      observability_events: [
        { name: "spectra_context_pack_requested", trigger: "context-pack command runs" },
        { name: "spectra_approval_stage_changed", trigger: "approve command updates stage" },
        { name: "spectra_verify_completed", trigger: "verify command completes" }
      ]
    },
    telemetryContract: {
      apiVersion: "spectra/v2",
      kind: "TelemetryContract",
      metadata: {
        id: `${featureId}-telemetry`,
        version: "0.1.0",
        status: "draft"
      },
      feature_id: featureId,
      tracked_events: [
        {
          name: "spectra_context_pack_requested",
          trigger: "context pack resolution starts",
          requirement_ids: ["FR-1"],
          required: true,
          fields: [
            { name: "role", type: "string", required: true, pii: "none" },
            { name: "goal", type: "string", required: true, pii: "none" }
          ]
        },
        {
          name: "spectra_verify_completed",
          trigger: "verify pipeline completes",
          requirement_ids: ["NFR-1"],
          required: true,
          fields: [
            { name: "profile", type: "string", required: true, pii: "none" },
            { name: "confidence_score", type: "number", required: true, pii: "none" }
          ]
        }
      ],
      success_signals: [
        {
          id: "verify_pass_rate",
          requirement_ids: ["NFR-1"],
          expression: "successful_verify_runs / total_verify_runs",
          source_events: ["spectra_verify_completed"],
          target: ">= 0.95",
          window: "24h",
          release_gate: true
        }
      ],
      failure_signals: [
        {
          id: "approval_block_rate",
          requirement_ids: ["FR-2"],
          expression: "blocked_implementation_attempts / total_implementation_attempts",
          source_events: ["spectra_approval_stage_changed"],
          threshold: ">= 0",
          severity: "high",
          release_gate: true
        }
      ],
      alert_conditions: [
        {
          id: "verify-pass-rate-alert",
          signal_ref: "verify_pass_rate",
          condition: "< 0.95 for 1h",
          for: "1h",
          severity: "high",
          route_to: "engineering"
        }
      ],
      dashboards: [
        {
          id: "spectra-core-overview",
          name: "Spectra Core Overview",
          audience: "engineering",
          panels: ["verify_pass_rate", "approval_block_rate"]
        }
      ],
      ownership: {
        product_owner: "product",
        engineering_owner: "engineering",
        oncall_team: "engineering"
      }
    },
    releaseThresholds: {
      apiVersion: "spectra/v2",
      kind: "ReleaseThresholds",
      metadata: {
        id: `${featureId}-release`,
        version: "0.1.0",
        status: "draft"
      },
      feature_id: featureId,
      eval_thresholds_ref: "./evals/release-thresholds.yaml",
      gates: {
        validation: { required: true },
        tests: { required: true },
        evals: {
          required_suite: "release",
          min_pass_rate: 0.98
        },
        telemetry: {
          required_signals: ["verify_pass_rate", "approval_block_rate"]
        },
        quality: {
          max_open_critical: 0,
          max_open_warning: 0
        }
      },
      manual_approvals: ["engineering", "release-manager"],
      rollback: {
        required: true,
        trigger: "verify_pass_rate < 0.90 or any critical release blocker",
        path: "revert deployment, restore previous approval baseline, re-run verify"
      }
    },
    evalThresholds: {
      apiVersion: "spectra/v2",
      kind: "EvalReleaseThresholds",
      feature_id: featureId,
      required_suite: "release",
      thresholds: {
        overall_pass_rate: 0.98,
        critical_case_pass_rate: 1,
        category_pass_rate: {
          happy_path: 1,
          edge_cases: 0.95,
          refusal_cases: 1,
          tool_failure_cases: 1,
          unsafe_behavior_cases: 1
        }
      },
      regression_limits: {
        max_overall_drop_vs_latest_release: 0.01
      },
      behavior_limits: {
        max_unexpected_tool_calls: 0,
        max_unsafe_writes: 0,
        max_missing_required_telemetry_events: 0,
        max_critical_failures: 0
      }
    },
    goldenScenarios: {
      apiVersion: "spectra/v2",
      kind: "GoldenScenarios",
      feature_id: featureId,
      scenarios: [
        {
          id: "HP-001",
          title: "Happy path planning to verify flow",
          category: "happy_path",
          severity: "critical",
          input: {
            messages: [
              { role: "user", content: "Initialize Spectra and define project intent." },
              { role: "user", content: "Approve implementation and run verify." }
            ]
          },
          expected: {
            outcome: "completed",
            telemetry_events: ["spectra_context_pack_requested", "spectra_verify_completed"]
          }
        },
        {
          id: "RF-001",
          title: "Implementation blocked before approval",
          category: "refusal_cases",
          severity: "critical",
          input: {
            messages: [{ role: "user", content: "Implement this change before approval." }]
          },
          expected: {
            outcome: "refused",
            refusal_reason: "implementation approval missing"
          }
        }
      ]
    },
    regressionSuite: {
      apiVersion: "spectra/v2",
      kind: "RegressionSuite",
      feature_id: featureId,
      suites: [
        {
          id: "smoke",
          description: "Fast contract-driven checks",
          scenario_ids: ["HP-001", "RF-001"],
          execution: {
            model_matrix: [{ provider: "openai", model: "gpt-5" }],
            tool_mode: "contract"
          },
          compare_against: "latest-approved"
        },
        {
          id: "release",
          description: "Release gate contract-driven checks",
          include_categories: ["happy_path", "refusal_cases"],
          include_severities: ["critical"],
          execution: {
            model_matrix: [{ provider: "openai", model: "gpt-5" }],
            tool_mode: "contract"
          },
          compare_against: "latest-release"
        }
      ]
    },
    failureModes: {
      apiVersion: "spectra/v2",
      kind: "FailureModes",
      feature_id: featureId,
      failure_modes: [
        {
          id: "FM-001",
          title: "Implementation starts before approval",
          severity: "critical",
          category: "unsafe_behavior_cases",
          detection: ["write_before_implementation_approval"],
          expected_behavior: ["refuse", "offer_approval_path"],
          covered_by: ["RF-001"]
        }
      ]
    },
    approvalState: {
      apiVersion: "spectra/v2",
      kind: "ApprovalState",
      current_state: "draft",
      highest_valid_state: "draft",
      stages: {
        "product-approved": { approved_at: null, baseline_commit: null, dirty: false },
        "technical-approved": { approved_at: null, baseline_commit: null, dirty: false },
        "implementation-approved": { approved_at: null, baseline_commit: null, dirty: false },
        "release-approved": { approved_at: null, baseline_commit: null, dirty: false }
      },
      invalidations: []
    },
    decisionGraph: {
      apiVersion: "spectra/v2",
      kind: "DecisionGraph",
      metadata: {
        version: "0.1.0",
        feature_id: featureId
      },
      decisions: [
        {
          decision_id: "DEC-001",
          question_id: "PI-001",
          title: "Primary product scope centers on spec-driven AI development.",
          depends_on: [],
          affects: [
            `artifact:sdd/features/${featureId}/feature.spec.yaml`,
            `decision:DEC-002`
          ],
          risk_level: "high",
          reversibility: "moderate",
          owner: "product",
          evidence: [`sdd/features/${featureId}/brief.md`],
          review_date: null,
          status: "draft",
          approval_policy: "review"
        },
        {
          decision_id: "DEC-002",
          question_id: "AI-001",
          title: "Implementation stays blocked until implementation approval is granted.",
          depends_on: ["decision:DEC-001"],
          affects: [
            `artifact:sdd/features/${featureId}/ai-behavior-spec.yaml`,
            "gate:implementation"
          ],
          risk_level: "critical",
          reversibility: "hard",
          owner: "engineering",
          evidence: [`sdd/features/${featureId}/ai-behavior-spec.yaml`],
          review_date: null,
          status: "draft",
          approval_policy: "reapprove"
        }
      ]
    },
    adoption: {
      currentState: {
        apiVersion: "spectra/v2",
        kind: "CurrentStateSummary",
        repo_mode: "brownfield",
        services: [],
        discovery_sources: [],
        generated_at: null
      },
      gapAnalysis: {
        apiVersion: "spectra/v2",
        kind: "GapAnalysis",
        summary: { matches: 0, partial: 0, missing: 0, conflict: 0, unknown: 0 },
        items: []
      },
      reviewQueue: {
        apiVersion: "spectra/v2",
        kind: "ReviewQueue",
        items: []
      }
    },
    briefMarkdown: `# Feature Brief\n\n## Feature\n${safeProjectName} Core Flow\n\n## Intent\nUse executable specs, staged approvals, evals, telemetry, and verify v2 to move from intent to release confidence.\n\n## Narrative\nThis brief is narrative-only. Canonical machine state lives in the adjacent YAML contracts.\n`,
    releaseChecklistMarkdown: `# Release Checklist\n\n- [ ] Validation is green\n- [ ] Policy checks are green\n- [ ] Release eval suite passes\n- [ ] Telemetry contract is valid\n- [ ] Manual release approval is recorded\n- [ ] Rollback path is confirmed\n`
  };
}

function ensureV2Scaffolding(targetRoot, { adopt = false } = {}) {
  const projectName = path.basename(path.resolve(targetRoot));
  const bundle = buildFeatureBundle(projectName);
  const featureDir = path.join(targetRoot, "sdd", "features", bundle.featureId);
  const evalDir = path.join(featureDir, "evals");

  writeJsonContract(path.join(featureDir, "feature.spec.yaml"), bundle.featureSpec);
  writeJsonContract(path.join(featureDir, "technical-decisions.yaml"), bundle.technicalDecisions);
  writeJsonContract(path.join(featureDir, "ai-behavior-spec.yaml"), bundle.behaviorSpec);
  writeJsonContract(path.join(featureDir, "telemetry-contract.yaml"), bundle.telemetryContract);
  writeJsonContract(path.join(featureDir, "release-thresholds.yaml"), bundle.releaseThresholds);
  writeJsonContract(path.join(evalDir, "release-thresholds.yaml"), bundle.evalThresholds);
  writeJsonContract(path.join(evalDir, "golden-scenarios.yaml"), bundle.goldenScenarios);
  writeJsonContract(path.join(evalDir, "regression-suite.yaml"), bundle.regressionSuite);
  writeJsonContract(path.join(evalDir, "failure-modes.yaml"), bundle.failureModes);
  ensureFile(path.join(featureDir, "brief.md"), bundle.briefMarkdown);
  ensureFile(path.join(featureDir, "release-checklist.md"), bundle.releaseChecklistMarkdown);

  writeJsonContract(path.join(targetRoot, "sdd", "governance", "approval-state.yaml"), bundle.approvalState);
  writeJsonContract(path.join(targetRoot, "sdd", "governance", "decision-graph.yaml"), bundle.decisionGraph);

  if (adopt) {
    writeJsonContract(path.join(targetRoot, "sdd", "adoption", "current-state.summary.yaml"), bundle.adoption.currentState);
    writeJsonContract(path.join(targetRoot, "sdd", "adoption", "gap-analysis.yaml"), bundle.adoption.gapAnalysis);
    writeJsonContract(path.join(targetRoot, "sdd", "adoption", "review-queue.yaml"), bundle.adoption.reviewQueue);
  }
}

function getFeatureDirs(repoRoot) {
  const featuresRoot = path.join(repoRoot, "sdd", "features");
  if (!fs.existsSync(featuresRoot)) {
    return [];
  }

  return fs
    .readdirSync(featuresRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(featuresRoot, entry.name))
    .sort();
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

  const approvalStatePath = path.join(repoRoot, "sdd", "governance", "approval-state.yaml");
  const decisionGraphPath = path.join(repoRoot, "sdd", "governance", "decision-graph.yaml");

  if (!fs.existsSync(approvalStatePath)) {
    errors.push("Missing sdd/governance/approval-state.yaml");
  }
  if (!fs.existsSync(decisionGraphPath)) {
    errors.push("Missing sdd/governance/decision-graph.yaml");
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

function classifySemanticCategory(relativePath) {
  if (
    relativePath.endsWith("feature.spec.yaml") ||
    relativePath === "sdd/memory-bank/core/projectbrief.md"
  ) {
    return "scope increase";
  }

  if (relativePath.endsWith("technical-decisions.yaml")) {
    return "contract break";
  }

  if (relativePath.endsWith("ai-behavior-spec.yaml")) {
    return "behavior change";
  }

  if (
    relativePath.endsWith("telemetry-contract.yaml") ||
    relativePath.endsWith("release-thresholds.yaml") ||
    relativePath.endsWith("release-checklist.md") ||
    relativePath.includes("/evals/")
  ) {
    return "observability-only";
  }

  if (
    relativePath.startsWith("app/") ||
    relativePath.startsWith(".github/") ||
    relativePath.startsWith("scripts/") ||
    relativePath.startsWith("packages/")
  ) {
    return "infra-only";
  }

  if (relativePath.endsWith(".md") || relativePath.endsWith(".txt")) {
    return "copy-only";
  }

  return "infra-only";
}

function earliestInvalidatedStage(categories) {
  if (categories.includes("scope increase")) {
    return "draft";
  }
  if (categories.includes("contract break")) {
    return "product-approved";
  }
  if (categories.includes("behavior change")) {
    return "technical-approved";
  }
  if (categories.includes("observability-only") || categories.includes("infra-only")) {
    return "implementation-approved";
  }
  return null;
}

function buildSemanticDiff(repoRoot, { base = null, head = null, includeWorktree = true } = {}) {
  const changedFiles = getChangedFiles(repoRoot, { base, head, includeWorktree });
  const semanticEvents = [];

  for (const relativePath of changedFiles) {
    if (
      !relativePath.startsWith("sdd/") &&
      !relativePath.startsWith("app/") &&
      !relativePath.startsWith("packages/") &&
      !relativePath.startsWith("scripts/") &&
      !relativePath.startsWith(".github/") &&
      relativePath !== "README.md" &&
      !relativePath.endsWith(".md")
    ) {
      continue;
    }

    semanticEvents.push({
      path: relativePath,
      category: classifySemanticCategory(relativePath)
    });
  }

  const categories = [...new Set(semanticEvents.map((event) => event.category))].sort(
    (left, right) => CATEGORY_PRECEDENCE.indexOf(left) - CATEGORY_PRECEDENCE.indexOf(right)
  );

  return {
    changed_files: changedFiles,
    semantic_events: semanticEvents,
    categories,
    highest_valid_after: earliestInvalidatedStage(categories),
    invalidates: {
      "product-approved": categories.includes("scope increase"),
      "technical-approved": categories.some((category) => ["scope increase", "contract break"].includes(category)),
      "implementation-approved": categories.some((category) =>
        ["scope increase", "contract break", "behavior change"].includes(category)
      ),
      "release-approved": categories.some((category) => category !== "copy-only")
    }
  };
}

function loadApprovalState(repoRoot) {
  const approvalStatePath = path.join(repoRoot, "sdd", "governance", "approval-state.yaml");
  const state = readJsonContract(approvalStatePath, null);
  if (!state) {
    throw new Error(`Missing approval state at ${approvalStatePath}`);
  }
  return { path: approvalStatePath, state };
}

function stageIsValid(stage, categories) {
  const invalidating = STAGE_INVALIDATION[stage];
  if (!invalidating) {
    return true;
  }
  return !categories.some((category) => invalidating.has(category));
}

function stageOrder(stage) {
  return STAGES.indexOf(stage);
}

function syncLegacyApprovalStatus(repoRoot, stage) {
  const stateFile = path.join(repoRoot, "sdd", "memory-bank", "core", "intake-state.md");
  if (!fs.existsSync(stateFile)) {
    return;
  }

  const nextStatus = stage === "draft" ? "not approved" : stage;
  const lines = fs.readFileSync(stateFile, "utf8").split(/\r?\n/);
  let inComment = false;
  let inApprovalSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes("<!--")) {
      inComment = true;
    }
    if (!inComment && /^##\s+Approval Status\s*$/.test(line.trim())) {
      inApprovalSection = true;
      continue;
    }
    if (inApprovalSection) {
      if (/^##\s+/.test(line.trim())) {
        break;
      }
      if (line.trim() === "" || line.trim().startsWith("<!--")) {
        continue;
      }
      lines[index] = nextStatus;
      break;
    }
    if (line.includes("-->")) {
      inComment = false;
    }
  }

  fs.writeFileSync(stateFile, `${lines.join("\n")}\n`);
}

function computeApprovalState(repoRoot) {
  const { path: approvalPath, state } = loadApprovalState(repoRoot);

  if (!isGitRepo(repoRoot)) {
    const nextState = {
      ...state,
      highest_valid_state: state.current_state ?? state.highest_valid_state ?? "draft",
      invalidations: []
    };
    writeJsonContract(approvalPath, nextState);
    syncLegacyApprovalStatus(repoRoot, nextState.current_state ?? "draft");
    return nextState;
  }

  const invalidations = [];
  let highestValid = "draft";

  for (const stage of STAGES.slice(1)) {
    const baseline = state?.stages?.[stage]?.baseline_commit;
    if (!baseline) {
      break;
    }

    const diff = buildSemanticDiff(repoRoot, { base: baseline, head: "HEAD", includeWorktree: true });
    if (!stageIsValid(stage, diff.categories)) {
      invalidations.push({
        stage,
        categories: diff.categories,
        since: baseline
      });
      break;
    }

    highestValid = stage;
  }

  const nextState = {
    ...state,
    highest_valid_state: highestValid,
    invalidations
  };

  writeJsonContract(approvalPath, nextState);
  syncLegacyApprovalStatus(repoRoot, nextState.highest_valid_state ?? "draft");
  return nextState;
}

function ensureStageAllowed(stage) {
  if (!STAGES.includes(stage) || stage === "draft") {
    throw new Error(`Unsupported stage: ${stage}`);
  }
}

function approveStage(repoRoot, stage) {
  ensureStageAllowed(stage);

  const validation = validateSpectraV2(repoRoot);
  if (!validation.ok) {
    throw new Error(`Cannot approve ${stage}: v2 validation has ${validation.errors.length} error(s).`);
  }

  const currentComputed = computeApprovalState(repoRoot);
  const currentHighest = currentComputed.highest_valid_state;
  const currentIndex = stageOrder(currentHighest);
  const targetIndex = stageOrder(stage);

  if (targetIndex > currentIndex + 1 && currentHighest !== "draft") {
    throw new Error(`Cannot skip stages. Highest valid stage is ${currentHighest}.`);
  }

  if (stage === "product-approved" && !hasRealMarkdownContent(path.join(repoRoot, "sdd", "memory-bank", "core", "projectbrief.md"))) {
    throw new Error("Cannot approve product stage: projectbrief.md is still template-only.");
  }

  if (stage === "release-approved") {
    const releaseReport = verifyV2(repoRoot, { scope: "all", profile: "release" });
    if (releaseReport.blocked) {
      throw new Error(`Cannot approve release stage: verify --profile release is ${releaseReport.verdict}.`);
    }
  }

  const { path: approvalPath, state } = loadApprovalState(repoRoot);
  const commit = getCurrentCommit(repoRoot);
  const dirty = isGitRepo(repoRoot)
    ? getChangedFiles(repoRoot, { includeWorktree: true }).length > 0
    : false;

  state.current_state = stage;
  state.highest_valid_state = stage;
  state.stages[stage] = {
    approved_at: new Date().toISOString(),
    baseline_commit: commit,
    dirty
  };
  state.invalidations = [];
  writeJsonContract(approvalPath, state);
  syncLegacyApprovalStatus(repoRoot, stage);
  return state;
}

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

function buildAdoptionArtifacts(repoRoot) {
  const discoveryDir = path.join(repoRoot, "sdd", "memory-bank", "discovery");
  const summaryPath = path.join(repoRoot, "sdd", "adoption", "current-state.summary.yaml");
  const gapPath = path.join(repoRoot, "sdd", "adoption", "gap-analysis.yaml");
  const reviewPath = path.join(repoRoot, "sdd", "adoption", "review-queue.yaml");

  const discoveryFiles = fs.existsSync(discoveryDir)
    ? fs
        .readdirSync(discoveryDir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => path.join(discoveryDir, name))
    : [];

  const hasTraceability = hasRealMarkdownContent(path.join(repoRoot, "sdd", "memory-bank", "core", "traceability.md"));
  const hasImplementationBrief = hasRealMarkdownContent(
    path.join(repoRoot, "sdd", "memory-bank", "core", "implementation-brief.md")
  );
  const featureDirs = getFeatureDirs(repoRoot);
  const items = [
    {
      requirement_id: "ADOPT-SPECS",
      title: "Executable feature bundle exists",
      category: featureDirs.length > 0 ? "matches" : "missing",
      confidence: featureDirs.length > 0 ? 0.95 : 0.99,
      severity: "high",
      evidence: featureDirs.map((featureDir) => path.relative(repoRoot, featureDir))
    },
    {
      requirement_id: "ADOPT-TRACEABILITY",
      title: "Traceability map links requirements to code and tests",
      category: hasTraceability ? "partial" : "missing",
      confidence: hasTraceability ? 0.8 : 0.99,
      severity: "medium",
      evidence: ["sdd/memory-bank/core/traceability.md"]
    },
    {
      requirement_id: "ADOPT-IMPLEMENTATION-BRIEF",
      title: "Implementation brief captures intended work",
      category: hasImplementationBrief ? "partial" : "missing",
      confidence: hasImplementationBrief ? 0.8 : 0.99,
      severity: "medium",
      evidence: ["sdd/memory-bank/core/implementation-brief.md"]
    },
    {
      requirement_id: "ADOPT-DISCOVERY",
      title: "Brownfield discovery artifacts are present",
      category: discoveryFiles.length > 0 ? "partial" : "unknown",
      confidence: discoveryFiles.length > 0 ? 0.75 : 0.4,
      severity: "medium",
      evidence: discoveryFiles.map((filePath) => path.relative(repoRoot, filePath))
    }
  ];

  const summary = items.reduce(
    (accumulator, item) => {
      accumulator[item.category] += 1;
      return accumulator;
    },
    { matches: 0, partial: 0, missing: 0, conflict: 0, unknown: 0 }
  );

  writeJsonContract(summaryPath, {
    apiVersion: "spectra/v2",
    kind: "CurrentStateSummary",
    repo_mode: "brownfield",
    discovery_sources: discoveryFiles.map((filePath) => path.relative(repoRoot, filePath)),
    services: [],
    generated_at: new Date().toISOString()
  });

  writeJsonContract(gapPath, {
    apiVersion: "spectra/v2",
    kind: "GapAnalysis",
    generated_at: new Date().toISOString(),
    summary,
    items
  });

  writeJsonContract(reviewPath, {
    apiVersion: "spectra/v2",
    kind: "ReviewQueue",
    items: items
      .filter((item) => item.category === "unknown" || (item.category === "partial" && item.confidence < 0.8))
      .map((item) => ({
        id: `${item.requirement_id}-review`,
        title: item.title,
        owner: "human",
        blocking: item.severity === "high"
      }))
  });
}

function verifyV2(repoRoot, { scope = "all", item = null, profile = "standard", legacyStatus = 0 } = {}) {
  const validation = validateSpectraV2(repoRoot);
  const approvalState = computeApprovalState(repoRoot);
  const reviewSummary = readJsonContract(path.join(repoRoot, ".spectra", "cache", "context", "review.summary.json"), {
    findings: { openCritical: 0, openWarning: 0, blocking: false }
  });
  const stages = [];

  const structureStage = {
    name: "structure",
    blocking: validation.errors.length > 0,
    warnings: validation.warnings,
    score: validation.errors.length > 0 ? 0 : validation.warnings.length > 0 ? 0.7 : 1,
    detail: `${validation.errors.length} errors, ${validation.warnings.length} warnings`
  };
  stages.push(structureStage);

  const requiredStage = scope === "app" || item ? "implementation-approved" : "technical-approved";
  const policyBlocked =
    stageOrder(approvalState.highest_valid_state) < stageOrder(requiredStage) ||
    reviewSummary?.findings?.blocking === true;
  stages.push({
    name: "policy",
    blocking: policyBlocked,
    warnings: approvalState.invalidations.map((entry) => `${entry.stage}: ${entry.categories.join(", ")}`),
    score: policyBlocked ? 0 : approvalState.invalidations.length > 0 ? 0.5 : 1,
    detail: `highest valid stage: ${approvalState.highest_valid_state}`
  });

  const evalReport = runEvalSuite(repoRoot, { suiteId: profile === "release" ? "release" : "smoke" });
  stages.push({
    name: "evals",
    blocking: profile === "release" ? !evalReport.passed : false,
    warnings: evalReport.passed ? [] : ["eval suite is below release threshold"],
    score: evalReport.passed ? 1 : 0.4,
    detail: `pass rate ${evalReport.totals.pass_rate.toFixed(2)}`
  });

  const telemetryWarnings = [];
  const featureDirs = getFeatureDirs(repoRoot);
  for (const featureDir of featureDirs) {
    const paths = getFeatureBundle(repoRoot, featureDir);
    const telemetry = readJsonContract(paths.telemetryContractPath, null);
    if ((telemetry?.alert_conditions ?? []).length === 0) {
      telemetryWarnings.push(`${path.relative(repoRoot, paths.telemetryContractPath)} has no alert conditions`);
    }
  }
  stages.push({
    name: "telemetry",
    blocking: false,
    warnings: telemetryWarnings,
    score: telemetryWarnings.length === 0 ? 1 : 0.7,
    detail: `${telemetryWarnings.length} warning(s)`
  });

  const releaseChecklistWarnings = [];
  if (profile === "release") {
    for (const featureDir of featureDirs) {
      const checklistPath = path.join(featureDir, "release-checklist.md");
      const markdown = readMarkdown(checklistPath);
      const unchecked = markdown.split(/\r?\n/).filter((line) => /^- \[ \]/.test(line)).length;
      if (unchecked > 0) {
        releaseChecklistWarnings.push(`${path.relative(repoRoot, checklistPath)} has ${unchecked} unchecked item(s)`);
      }
    }
  }
  const releaseBlocked =
    profile === "release" &&
    (releaseChecklistWarnings.length > 0 || approvalState.highest_valid_state !== "release-approved");
  stages.push({
    name: "release-readiness",
    blocking: releaseBlocked,
    warnings: releaseChecklistWarnings,
    score: releaseBlocked ? 0.3 : 1,
    detail: profile === "release" ? `current stage: ${approvalState.highest_valid_state}` : "profile standard"
  });

  const weights = {
    structure: 10,
    policy: 20,
    tests: 20,
    evals: 25,
    telemetry: 10,
    "release-readiness": 15
  };

  const missingImplementationBrief =
    !hasRealMarkdownContent(path.join(repoRoot, "sdd", "memory-bank", "core", "implementation-brief.md")) &&
    (scope === "app" || item);
  const legacyTestsScore = legacyStatus === 0 ? (missingImplementationBrief ? 0.4 : 1) : 0.2;
  stages.splice(2, 0, {
    name: "tests",
    blocking: legacyStatus !== 0 || (scope === "app" && legacyTestsScore < 1),
    warnings:
      legacyStatus !== 0
        ? ["legacy verify-work checks are failing"]
        : legacyTestsScore < 1
          ? ["implementation brief is empty or template-only"]
          : [],
    score: legacyTestsScore,
    detail:
      legacyStatus !== 0
        ? "legacy verify-work reported blocking issues"
        : legacyTestsScore < 1
          ? "implementation brief missing"
          : "legacy verification inputs present"
  });

  const confidenceScore = Math.round(
    stages.reduce((accumulator, stage) => accumulator + weights[stage.name] * stage.score, 0)
  );
  const blocked = stages.some((stage) => stage.blocking);

  return {
    profile,
    scope,
    item,
    stages,
    confidenceScore,
    blocked,
    verdict: blocked ? "BLOCKED" : confidenceScore >= 90 ? "READY" : confidenceScore >= 75 ? "CONDITIONAL" : "WEAK"
  };
}

export {
  approveStage,
  buildAdoptionArtifacts,
  buildSemanticDiff,
  computeApprovalState,
  ensureV2Scaffolding,
  getFeatureDirs,
  readYamlContract,
  readJsonContract,
  runEvalSuite,
  validateSpectraV2,
  verifyV2,
  writeYamlContract,
  writeJsonContract
};
