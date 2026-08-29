# Spectra Overview

Spectra is a CLI-first operating system for AI-assisted product development.

It gives teams one repository-native way to move from product intent to release confidence:

1. define executable specs
2. validate structure and policy
3. advance staged approvals
4. implement with role-aware context
5. evaluate product behavior
6. verify release readiness

## Product Model

Spectra is built around a hybrid documentation model:

- Markdown is for narrative, intent, and human context.
- YAML is for canonical machine-readable contracts.
- Generated summaries are for agents and CI.

The goal is to keep product intent readable while making validation, eval, telemetry, approval, and release gates executable.

## What Makes Spectra v2 Different

### CLI-first

The public product surface is `spectra`, not `bash scripts/...` and not chat-only workflows.

### Executable specs

Feature state lives under `sdd/features/<feature-id>/` as YAML contracts plus a short Markdown brief.

### AI behavior specs

Assistant behavior is defined at the spec layer: model dependencies, tool contracts, allowed/disallowed actions, confidence policy, fallback behavior, escalation, human review, refusal policy, and observability events.

### Staged approvals

Spectra uses:

- `draft`
- `product-approved`
- `technical-approved`
- `implementation-approved`
- `release-approved`

Implementation is blocked until `implementation-approved`. Release signoff is blocked until `release-approved`.

### Eval and verify

In Full, `spectra admin eval` checks behavior contracts and scenario suites.

`spectra verify` aggregates structure, policy, tests, eval readiness, telemetry coverage, approval state, and release confidence.

### Token-aware context

`spectra context --role <role> --goal <goal>` loads the minimum useful context instead of dumping the whole repo into every agent.

## Canonical State

Structured source of truth:

- `sdd/features/<feature-id>/feature.spec.yaml`
- `sdd/features/<feature-id>/ai-behavior-spec.yaml`
- `sdd/features/<feature-id>/telemetry-contract.yaml`
- `sdd/features/<feature-id>/technical-decisions.yaml`
- `sdd/features/<feature-id>/release-thresholds.yaml`
- `sdd/features/<feature-id>/evals/*`
- `sdd/governance/approval-state.yaml`
- `sdd/governance/decision-graph.yaml`

Human-readable support context:

- `sdd/features/<feature-id>/brief.md`
- `sdd/features/<feature-id>/release-checklist.md`
- optional notes under `sdd/memory-bank/`

## Recommended Reading Order

1. [Quick Start](quick-start.md)
2. [Getting Started](getting-started.md)
3. [CLI Reference](cli-reference.md)
4. [Structure](structure.md)
5. [Workflow](workflow.md)
6. [Examples](examples/README.md)
# Business context routing

Use `spectra route --task "<task description>"` before a normal development task. Spectra returns the smallest relevant technical-module and business-domain context and defers unrelated rule files. Business rules live once under `sdd/memory-bank/business/`; use `spectra knowledge add` for reusable evidence-backed rules and `spectra knowledge promote` after resolving uncertainty.
