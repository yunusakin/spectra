# Agent Adapter (Generic)

All canonical rules live in `sdd/.agent/`.

## Read First
- `sdd/.agent/README.md`
- `sdd/.agent/rules/index.md`

## Triggers
- If the user message is exactly `init`: start intake and do not write any application code.
- After specs are written and validation passes: ask for explicit approval (reply `approved`).

## Hard Rules (Summary)
- Do not generate application code before explicit approval.
- All application code must be generated under `app/` only.
- If `app/` does not exist, create it after approval before writing any code.
- Specs and decisions live under `sdd/memory-bank/` and must be updated before/with code changes.
- If a free-text answer is blank, do not write any section for it.
- Free-text answers may use Markdown; keep it concise and prefer bullets.
- Run intake in phases and validate checkpoints per `sdd/.agent/rules/intake/02-validation.md`.
- Use `sdd/memory-bank/core/intake-state.md` to resume intake if interrupted.
- After intake, auto-fill spec files with collected answers (omit blank sections).
- After approval, follow the approval gate including sprint plan creation.

## Canonical Workflows
- Intake: `sdd/.agent/rules/intake/00-intake-flow.md`
- Questions: `sdd/.agent/rules/intake/01-questions.md`
- Validation: `sdd/.agent/rules/intake/02-validation.md`
- Approval gate: `sdd/.agent/rules/approval/00-approval-gate.md`
- Skills (post-approval): `sdd/.agent/rules/skills/00-skill-usage.md`
