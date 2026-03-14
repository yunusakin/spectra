# Spectra Overview

## Purpose

Spectra is a spec-driven backbone for AI-assisted software delivery.
It combines structured specs, explicit approvals, and workflow guardrails so implementation stays aligned with intent.
The canonical runtime is agent-independent; tool-specific instruction files are generated artifacts, not source of truth.

## Core Principles

- Specs first, code second.
- No application code before explicit `approved`.
- Persistent memory across sessions (`sdd/memory-bank/`).
- Technical choices must be confirmed and logged.
- Delivery loop includes validation and challenge gates.
- Canonical rules live under `sdd/system/`.

## Lifecycle

1. Intake: collect project requirements in phases.
2. Decision capture: log confirmed technical choices and unresolved technical questions.
3. Specs: write/update memory-bank files.
4. Validation: resolve missing/inconsistent inputs.
5. Approval: user replies `approved`.
6. Scaffold: generate project skeleton under `app/`.
7. Discuss implementation intent: write `implementation-brief.md`.
8. Sprint loop: code -> validate -> challenge -> resolve/escalate.
9. Verify work: aggregate gates before handoff.
10. Ship: finalize release notes and rollback readiness.

## Key Paths

- `sdd/system/` - canonical rules, runtime manifests, skills, scaffolds, prompts, adapters.
- `sdd/memory-bank/core/invariants.md` - non-negotiable anchors.
- `sdd/memory-bank/core/intake-state.md` - phase, decision log, open questions, approval state.
- `sdd/memory-bank/core/review-gate.md` - severity findings and resolution state.
- `sdd/memory-bank/core/implementation-brief.md` - pre-execution intent lock.
- `sdd/memory-bank/discovery/` - unconfirmed brownfield observations.
- `app/` - application code only (post-approval).
- `scripts/` - validation, policy, health, and spec-diff helpers.
- `docs/` - guides and examples.

## Next Docs

- [Quick Start](quick-start.md)
- [Getting Started](getting-started.md)
- [Workflow Guide](workflow.md)
