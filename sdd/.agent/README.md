# Canonical Agent Rules

This directory is the single source of truth for all agent rules.
Use `rules/index.md` to locate the correct rule file for a task.

Key workflow:
- Type `init` to start intake.
- Capture specs under `sdd/memory-bank/`.
- Wait for explicit approval before generating any application code.
- Generate all application code under `app/` only.
- Auto-fill spec files after intake with collected answers.

Skills live under `sdd/.agent/skills/` and are used after approval.
Prompts live under `sdd/.agent/prompts/` and are optional reusable templates/checklists.
