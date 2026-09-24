// Narrative and behavioral contracts: feature spec, technical decisions, AI behavior, telemetry, brief and release checklist.
function buildSpecDefaults({ featureId, safeProjectName }) {
  return {
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
            statement: "Verification must aggregate structure validation, policy, verify-work checks (project tests are not run), evals, telemetry, and release readiness.",
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
          "run spectra check",
          "run spectra approve --stage implementation-approved",
          "run spectra verify --profile release"
        ]
      },
      observability_events: [
        { name: "spectra_context_pack_requested", trigger: "context command runs" },
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
    briefMarkdown: `# Feature Brief\n\n## Feature\n${safeProjectName} Core Flow\n\n## Intent\nUse executable specs, staged approvals, evals, telemetry, and spectra verify to move from intent to release confidence.\n\n## Narrative\nThis brief is narrative-only. Canonical machine state lives in the adjacent YAML contracts.\n`,
    releaseChecklistMarkdown: `# Release Checklist\n\n- [ ] Validation is green\n- [ ] Policy checks are green\n- [ ] Release eval suite passes\n- [ ] Telemetry contract is valid\n- [ ] Manual release approval is recorded\n- [ ] Rollback path is confirmed\n`
  };
}

export { buildSpecDefaults };
