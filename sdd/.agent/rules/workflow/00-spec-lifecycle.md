# Spec Lifecycle and Change Workflow

This rule defines intake resume behavior, post-approval spec changes, and rollback-safe tracking.

## Intake Interruption / Resume
- Checkpoint intake after each phase (1, 2, 2b, 3).
- Record in `sdd/memory-bank/core/intake-state.md`:
  - current phase
  - completed phases
  - missing mandatory answers
  - validation errors
  - approval status (`not approved` / `approved`)
  - decision log entries for technical choices
  - open technical questions (`open` / `resolved`)
  - last updated date

If user runs `init` again:
- ask only missing mandatory answers first
- continue the next smallest relevant batch

## After Approval: Specs Stay Source-of-Truth
- Specs must be updated before (or in the same change as) behavior-changing code.
- If user requests behavior changes, update specs first and validate before coding further.

## Spec Change Workflow (Post-Approval)
1. Clarify the requested change.
2. Update impacted specs under `sdd/memory-bank/`.
3. Append entry to `sdd/memory-bank/core/spec-history.md`.
4. Update spec diff report (`bash scripts/spec-diff.sh --update`) when useful.
5. Re-run intake validation for impacted mandatory fields.
6. Decide re-approval need.
7. If re-approval required:
   - set Approval Status to `not approved`
   - stop and ask for `approved`
   - set back to `approved` only after user confirmation
8. Update sprint files if used.

## Re-Approval Required (Default: Yes)
Require explicit re-approval if any of these change:
- app type
- primary language/framework/version
- architecture style
- primary datastore/version
- deployment target
- API style or external contracts
- auth/authz model
- NFRs requiring redesign
- must-have feature scope

## Discovery During Implementation
If coding reveals ambiguity:
1. Stop ambiguous part.
2. Add entry to `sdd/memory-bank/core/activeContext.md` Open Decisions.
3. Add or update row in `sdd/memory-bank/core/intake-state.md` Open Technical Questions.
4. Propose spec update.
5. Resolve question, update specs first, then continue coding.

## Rollback Mechanism
- Prefer additive history (`git revert`) over history rewrite.
- Update specs to post-rollback intent.
- Record rollback in `sdd/memory-bank/core/spec-history.md`.

## Progress Tracking (Mandatory)
After every task that modifies files, update `sdd/memory-bank/core/progress.md` with:
- latest status
- concise change summary
- clear next steps
