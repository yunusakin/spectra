# Spectra Overview

## Purpose

Spectra is a spec-driven backbone for AI-assisted software delivery.
It combines structured specs, explicit approvals, and workflow guardrails so implementation stays aligned with intent.

## Core Principles

- Specs first, code second.
- No application code before explicit `approved`.
- Persistent memory across sessions (`sdd/memory-bank/`).
- Delivery loop includes planning, coding, testing, verification, and traceability.

## Lifecycle

1. Intake: collect project requirements in phases.
2. Specs: write/update memory-bank files.
3. Validation: resolve missing/inconsistent inputs.
4. Approval: user replies `approved`.
5. Scaffold: generate project skeleton under `app/`.
6. Sprint loop: pick item -> plan -> skill checks -> code -> test -> verify.
7. Ship: finalize release notes and rollback readiness.

## Key Paths

- `sdd/.agent/` - canonical rules, skills, scaffolds, prompts.
- `sdd/memory-bank/` - project specs, context, progress, traceability.
- `app/` - application code only (post-approval).
- `scripts/` - validation, policy, health, and spec-diff helpers.
- `docs/` - guides and examples.

## Next Docs

- [Quick Start](quick-start.md)
- [Getting Started](getting-started.md)
- [Workflow Guide](workflow.md)
