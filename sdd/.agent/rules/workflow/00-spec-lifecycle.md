# Spec Lifecycle and Change Workflow

This rule defines what happens when intake is interrupted, when specs change after approval, and how to track and roll back changes.

## Intake Interruption / Resume
- Intake must be checkpointed after each phase (Phase 1, 2, 2b, 3).
- Record progress in `sdd/memory-bank/core/intake-state.md`:
  - current phase
  - completed phases
  - missing mandatory answers
  - validation errors
  - last updated date
- If the user runs `init` again and specs already contain partial answers:
  - treat it as resume
  - ask only missing mandatory answers first
  - then continue the next smallest relevant batch of questions

## After Approval: Keeping Specs Source-Of-Truth
- Specs must be updated before (or at least in the same change as) any behavior-changing code.
- If the user asks for a change that affects behavior, update specs first and validate before coding further.

## Spec Change Workflow (Post-Approval)
When requirements/constraints/tech choices change after approval:

1. Clarify the change in one or two questions if needed.
2. Update the relevant spec files under `sdd/memory-bank/` first.
3. Append an entry to `sdd/memory-bank/core/spec-history.md` describing:
   - version/date
   - summary
   - high-level files touched
   - whether re-approval is required
4. Update the spec diff report (recommended):
   - if baseline is not initialized yet: run `bash scripts/spec-diff.sh --init`
   - otherwise: run `bash scripts/spec-diff.sh --update`
5. Re-run intake validation rules (`sdd/.agent/rules/intake/02-validation.md`) for any impacted mandatory fields.
6. Decide whether re-approval is required (see below).
7. If re-approval is required: stop, summarize the changes, and ask the user to reply `approved` to continue implementation.
8. Update sprint files if used:
   - `sdd/memory-bank/core/sprint-plan.md`
   - `sdd/memory-bank/core/sprint-current.md`

### When Re-Approval Is Required (Default: Yes)
Require explicit re-approval if any of these change:
- App type
- Primary language/framework (or versions)
- Architecture style
- Primary data store (or versions)
- Deployment target
- API style or external API contracts
- Authentication/authorization model
- Any non-functional requirement that forces a redesign (latency, availability, compliance)
- Scope: adding/removing must-have features

Re-approval is not required for non-behavioral changes like:
- typos, clarifications, formatting
- adding examples
- making implicit assumptions explicit without changing behavior

## Rollback Mechanism
If code/spec changes need to be undone:

- Prefer additive history:
  - create a new commit that reverts the change
  - prefer `git revert` over rewriting history
- Update specs first to reflect the intended state after rollback.
- Record the rollback in `sdd/memory-bank/core/spec-history.md` with the reason.
- If the rollback is ambiguous or destructive, ask for confirmation before executing it.

## Automated Progress Tracking (Mandatory)
At the end of every task where a file is modified (spec or code), the agent MUST update `sdd/memory-bank/core/progress.md` with:
- The latest task status.
- A concise summary of what was changed.
- Clear next steps.

This ensures the Memory Bank remains the source of truth for the project's current state and prevents desynchronization during long sessions or between different agents.
