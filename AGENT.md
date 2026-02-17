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
- After every task where files are modified, update `sdd/memory-bank/core/progress.md`.
- At session start, read `sdd/memory-bank/core/activeContext.md`. At end of every significant task, update it.

## Canonical Workflows
- Intake: `sdd/.agent/rules/intake/00-intake-flow.md`
- Questions: `sdd/.agent/rules/intake/01-questions.md`
- Validation: `sdd/.agent/rules/intake/02-validation.md`
- Discovery mode: `sdd/.agent/rules/intake/03-discovery.md`
- Spec lifecycle: `sdd/.agent/rules/workflow/00-spec-lifecycle.md`
- Approval gate: `sdd/.agent/rules/approval/00-approval-gate.md`
- Sprint execution: `sdd/.agent/rules/workflow/01-sprint-execution.md`
- Post-code verification: `sdd/.agent/rules/workflow/02-post-code-verification.md`
- Scaffolding: `sdd/.agent/scaffolds/README.md`
- Skills (post-approval): `sdd/.agent/rules/skills/00-skill-usage.md`
- Skill auto-selection: `sdd/.agent/rules/skills/01-skill-auto-select.md`
