# Approval Gate

- After intake, write spec files under `sdd/memory-bank/`.
- Stop and ask for explicit approval (reply `approved`).
- Do not generate any application code before approval.
- Before approval, set `## Approval Status` in `sdd/memory-bank/core/intake-state.md` to `not approved`.

## Pre-Approval Validation (Mandatory)
Before asking for approval, the agent MUST:
1. Run `bash scripts/validate-repo.sh --strict` and confirm it passes.
2. Ensure `sdd/memory-bank/core/intake-state.md` has no `open` technical questions.
3. Ensure `sdd/memory-bank/core/review-gate.md` has no unresolved `critical` or `warning` findings.
4. If any check fails, resolve it first — do not ask for approval.

## Approval Transition
When user replies `approved`:
1. Set `## Approval Status` in `sdd/memory-bank/core/intake-state.md` to `approved`.
2. Confirm open technical question list is empty.
3. Create the `app/` directory if it doesn't exist.
4. Generate code only under `app/`.
5. Say "I will create sprint plan" and populate:
   - `sdd/memory-bank/core/sprint-plan.md`
   - `sdd/memory-bank/core/sprint-current.md`
6. Append an entry to `sdd/memory-bank/core/spec-history.md`.

## After Approval (Spec Changes)
If requirements or technical choices change after approval:
- update relevant spec files first
- append a row to `sdd/memory-bank/core/spec-history.md`
- re-run validation (`sdd/.agent/rules/intake/02-validation.md`)
- if change impacts behavior or mandatory fields:
  - set `## Approval Status` to `not approved`
  - ask for explicit re-approval (`approved`) before continuing
