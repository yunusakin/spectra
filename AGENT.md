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
- Use intake question IDs and confirmation rules for technical decisions.
- Do not ask for approval while open technical questions exist.
- Do not advance stable status with unresolved `critical`/`warning` review findings.
- After every task where files are modified, update `sdd/memory-bank/core/progress.md`.
- At session start, read `sdd/memory-bank/core/activeContext.md`. At end of every significant task, update it.

## Canonical Workflows
- Intake: `sdd/.agent/rules/intake/00-intake-flow.md`
- Questions: `sdd/.agent/rules/intake/01-questions.md`
- Validation: `sdd/.agent/rules/intake/02-validation.md`
- Discovery mode: `sdd/.agent/rules/intake/03-discovery.md`
- Question contract: `sdd/.agent/rules/intake/04-question-contract.md`
- Question catalog: `sdd/.agent/rules/intake/05-question-catalog.md`
- Spec lifecycle: `sdd/.agent/rules/workflow/00-spec-lifecycle.md`
- Sprint execution: `sdd/.agent/rules/workflow/01-sprint-execution.md`
- Post-code verification: `sdd/.agent/rules/workflow/02-post-code-verification.md`
- Role loop gate: `sdd/.agent/rules/workflow/03-role-loop-gate.md`
- Escalation policy: `sdd/.agent/rules/workflow/04-escalation-policy.md`
- Approval gate: `sdd/.agent/rules/approval/00-approval-gate.md`
- Scaffolding: `sdd/.agent/scaffolds/README.md`
- Skills (post-approval): `sdd/.agent/rules/skills/00-skill-usage.md`
- Skill auto-selection: `sdd/.agent/rules/skills/01-skill-auto-select.md`
