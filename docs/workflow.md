# Workflow Guide

How to resume intake, work through sprints, change specs after approval, and roll back changes.

## Resume Intake
- Intake progress is tracked in `sdd/memory-bank/core/intake-state.md`.
- If you stop mid-intake, re-run `init`. The agent will:
  - read existing spec files
  - ask only for missing mandatory answers
  - continue with the next phase

## After Approval

### Scaffolding
After `approved`, the agent:
1. Creates the `app/` directory if it doesn't exist.
2. Picks a scaffold template from `sdd/.agent/scaffolds/` based on the app type.
3. Generates the project skeleton under `app/`.

### Sprint Execution
The agent works through sprint items in a loop:
1. Pick the next item from the sprint backlog.
2. Plan the implementation.
3. Apply relevant skill checklists (API design, DB migration, security, testing).
4. Code under `app/`.
5. Test — fix failures before moving on.
6. Verify — build passes, tests pass, code matches specs, traceability updated.
7. Update `progress.md` and `activeContext.md`.
8. Repeat until the sprint is done.

See: `sdd/.agent/rules/workflow/01-sprint-execution.md`

### Post-Code Verification
Before marking any task done, the agent checks:
- Build compiles without errors
- Existing tests still pass, new code has tests
- Implementation matches the specs
- `traceability.md` is updated with code + test locations

See: `sdd/.agent/rules/workflow/02-post-code-verification.md`

### Discovery Protocol
If coding reveals that a requirement is ambiguous or impossible:
1. Agent stops coding the ambiguous part.
2. Documents the issue in `activeContext.md` → Open Decisions.
3. Proposes a spec update to the user.
4. Waits for approval before continuing.

See: `sdd/.agent/rules/workflow/00-spec-lifecycle.md` (Discovery During Implementation)

## Spec Changes After Approval
If you change requirements or technical choices after `approved`:

1. Update the relevant spec files under `sdd/memory-bank/` first.
2. Record the change in `sdd/memory-bank/core/spec-history.md`.
3. Optionally update the spec diff report: `bash scripts/spec-diff.sh --update`.
4. Re-run validation for impacted fields.
5. If the change affects behavior or any mandatory field, the agent pauses for re-approval.

## Change Tracking
Use `sdd/memory-bank/core/spec-history.md` to track:
- initial approval (v1)
- major spec changes (v2, v3, ...)
- any re-approvals

## Rollback
If a change was wrong or premature:
- prefer a new commit that reverts the change (avoid rewriting git history)
- update specs to reflect the intended state after rollback
- record the rollback in `sdd/memory-bank/core/spec-history.md`
