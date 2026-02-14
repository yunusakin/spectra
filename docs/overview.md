# Spectra Overview

## What It Is

Spectra is a spec-driven development backbone for AI-assisted software projects. It gives AI coding agents a structured memory, a disciplined workflow, and guardrails that prevent common failure modes like context loss, spec drift, and unvalidated code.

## Core Principles

- **Specs first, code second.** Every project starts with structured spec files, not code.
- **Explicit approval gate.** No application code is generated until the user says `approved`.
- **Persistent memory.** Specs, progress, decisions, and context carry over between sessions.
- **Full lifecycle.** Covers intake through shipping — not just the first prompt.

## Full Lifecycle

| Phase | What Happens | Key Files |
|-------|-------------|-----------|
| Intake | Agent asks project questions in phases | `sdd/.agent/rules/intake/` |
| Specs | Answers fill structured spec files | `sdd/memory-bank/` |
| Validation | Checks for missing or inconsistent specs | `sdd/.agent/rules/intake/02-validation.md` |
| Approval | User reviews and replies `approved` | `sdd/.agent/rules/approval/00-approval-gate.md` |
| Scaffold | Agent sets up project skeleton from a template | `sdd/.agent/scaffolds/` |
| Sprint loop | Pick item → plan → skill check → code → test → verify → update | `sdd/.agent/rules/workflow/01-sprint-execution.md` |
| Post-code checks | Build, test, spec alignment, traceability | `sdd/.agent/rules/workflow/02-post-code-verification.md` |
| Ship | Changelog, migration checks, rollback plan | `sdd/.agent/skills/release-prep/` |

## Key Paths

- `sdd/` — rules, memory bank, skills, scaffolds, prompts
- `app/` — application code (generated after approval only)
- `docs/` — project documentation and examples
- `scripts/` — validation, policy checks, health dashboard

## Next Steps

- [Quick start](quick-start.md) — shortest path to `approved`
- [Getting started](getting-started.md) — full walkthrough
- [Workflow guide](workflow.md) — resume, spec changes, rollback
