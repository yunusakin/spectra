# Approval Gate

- After intake, write spec files under `sdd/memory-bank/`.
- Stop and ask for explicit approval (reply "approved").
- Do not generate any application code before approval.
- When approved:
  1. Create the `app/` directory if it doesn't exist.
  2. Generate code only under `app/`.
  3. Say "I will create sprint plan" and populate `sdd/memory-bank/core/sprint-plan.md` and `sdd/memory-bank/core/sprint-current.md`.
  4. Append an entry to `sdd/memory-bank/core/spec-history.md` (initial approval).

## Pre-Approval Validation (Mandatory)
Before asking for approval, the agent MUST:
1. Run `bash scripts/validate-repo.sh` and confirm it passes.
2. If it reports errors, fix them first — do not ask for approval until all checks pass.

## After Approval (Spec Changes)
- If requirements or technical choices change after approval:
  - update the relevant spec files first
  - append a row to `sdd/memory-bank/core/spec-history.md`
  - re-run validation (`sdd/.agent/rules/intake/02-validation.md`)
  - if the change impacts behavior or mandatory fields, ask for explicit re-approval (reply `approved`) before continuing
