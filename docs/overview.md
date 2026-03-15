# Spectra Overview

## Purpose

Spectra is a CLI-first operating system for AI-assisted product development.
It combines executable specs, staged approvals, workflow guardrails, evals, and release checks so implementation stays aligned with intent.
The canonical runtime is agent-independent; tool-specific instruction files are generated artifacts, not source of truth.

## Core Principles

- Specs first, code second.
- No application code before explicit `implementation-approved`.
- Structured state lives in YAML; long-form context stays in Markdown.
- Persistent memory across sessions (`sdd/memory-bank/`).
- Technical choices must be confirmed and logged.
- Delivery loop includes validation, eval, telemetry, and release confidence gates.
- Canonical rules live under `sdd/system/`.

## Lifecycle

1. Intake: collect product intent, technical architecture, AI behavior, evaluation, and release decisions.
2. Decision capture: log confirmed choices and unresolved questions.
3. Specs: write/update feature YAML contracts and supporting brief docs.
4. Validation: resolve missing, inconsistent, or stale state.
5. Approval: advance through `product-approved`, `technical-approved`, and `implementation-approved`.
6. Scaffold: generate project skeleton under `app/`.
7. Discuss implementation intent: write `implementation-brief.md`.
8. Sprint loop: code -> validate -> review -> resolve/escalate.
9. Verify work: aggregate tests, evals, telemetry, and release readiness.
10. Ship: run release verification and advance to `release-approved`.

## Key Paths

- `packages/cli/` - public CLI package and packaged assets.
- `packages/core/` - internal runtime source assets.
- `packages/templates/` - internal template source assets.
- `sdd/features/` - canonical executable spec bundles.
- `sdd/governance/` - approval state and decision graph.
- `sdd/system/` - canonical rules, runtime manifests, skills, scaffolds, prompts, adapters.
- `sdd/memory-bank/` - long-form human context and operational history.
- `sdd/adoption/` - structured brownfield discovery and gap analysis outputs.
- `app/` - application code only (post-approval).
- `docs/` - guides and examples.

## Next Docs

- [Quick Start](quick-start.md)
- [Getting Started](getting-started.md)
- [Structure](structure.md)
- [Workflow Guide](workflow.md)
