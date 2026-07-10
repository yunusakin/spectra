# Runtime Minimal Context

This manifest defines the minimum context loading strategy to reduce token cost.

## Always Load
- `sdd/system/runtime/minimal.md`
- `sdd/system/rules/index.md`
- `sdd/memory-bank/core/activeContext.md`
- `sdd/memory-bank/core/progress.md`

## Intake/Resume Mode
Load only:
- `sdd/system/rules/intake/00-intake-flow.md`
- `sdd/system/rules/intake/01-questions.md`
- `sdd/system/rules/intake/02-validation.md`
- `sdd/system/rules/intake/04-question-contract.md`
- `sdd/system/rules/intake/05-question-catalog.md`
- `sdd/memory-bank/core/intake-state.md`

Then load exactly one relevant question pack:
- Phase 1: `sdd/system/rules/intake/questions/01-phase-1-core.md`
- Phase 2: one app-type file (or backend+web for full-stack)
- Phase 2b: `08-phase-2b-api-style.md` only if API-style follow-up is required
- Phase 3: `09-phase-3-advanced.md` only if user opts in

## Post-Approval Implementation Mode
Load only:
- `sdd/system/rules/workflow/01-sprint-execution.md`
- `sdd/system/rules/workflow/02-post-code-verification.md`
- `sdd/system/rules/workflow/03-role-loop-gate.md`
- `sdd/system/rules/workflow/04-escalation-policy.md`
- `sdd/system/rules/skills/01-skill-auto-select.md`
- `sdd/memory-bank/core/review-gate.md`
- `sdd/memory-bank/core/skill-runs.md`

## Guardrails
- Never load all intake question packs in the same turn.
- Prefer delta updates over full file rewrites in progress/context files.
- If uncertain which pack to load, ask one targeted clarification.
