# Spectra Overview

## Purpose
Spectra provides a spec-driven backbone that keeps project structure stable while working with any agent.

## Core Principles
- Specs first, code second
- Stable structure across projects
- Clear approval gates before coding
- All application code lives under `app/`

## Workflow
1. Start intake with `init`.
2. Answer mandatory questions.
3. Review auto-filled spec files.
4. Reply `approved` to start coding.
5. After approval, the agent will ensure `app/` exists (create it if missing) and generate application code under `app/` only.

See `docs/workflow.md` for resume, spec change, and rollback guidance.

## Key Paths
- `sdd/` rules, memory bank, and process artifacts
- `app/` application code only (generated after approval)
- `docs/` project documentation
- `scripts/` helper scripts
