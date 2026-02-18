# Spectra Overview

## Purpose

Spectra is a spec-driven backbone for AI-assisted software delivery.
It combines structured specs, explicit approvals, and workflow guardrails so implementation stays aligned with intent.

## Core Principles

- Specs first, code second.
- No application code before explicit `approved`.
- Persistent memory across sessions (`sdd/memory-bank/`).
- Technical choices must be confirmed and logged.
- Delivery loop includes validation and challenge gates.

## Lifecycle

1. Intake: collect project requirements in phases.
2. Decision capture: log confirmed technical choices and unresolved technical questions.
3. Specs: write/update memory-bank files.
4. Validation: resolve missing/inconsistent inputs.
5. Approval: user replies `approved`.
6. Scaffold: generate project skeleton under `app/`.
7. Sprint loop: code -> validate -> challenge -> resolve/escalate.
8. Ship: finalize release notes and rollback readiness.

## Key Paths

- `sdd/.agent/` - canonical rules, skills, scaffolds, prompts.
- `sdd/memory-bank/core/invariants.md` - non-negotiable anchors.
- `sdd/memory-bank/core/intake-state.md` - phase, decision log, open questions, approval state.
- `sdd/memory-bank/core/review-gate.md` - severity findings and resolution state.
- `app/` - application code only (post-approval).
- `scripts/` - validation, policy, health, and spec-diff helpers.
- `docs/` - guides and examples.

## Next Docs

- [Quick Start](quick-start.md)
- [Getting Started](getting-started.md)
- [Workflow Guide](workflow.md)
