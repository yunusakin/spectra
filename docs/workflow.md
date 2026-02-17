# Workflow Guide

How to resume intake, execute sprints after approval, handle discovery during implementation, and roll back safely.

## Resume Intake

- Intake progress is tracked in `sdd/memory-bank/core/intake-state.md`.
- If intake is interrupted, run `init` again.
- Agent should ask only missing mandatory answers, then continue with the next phase.

## After `approved`

### Scaffolding

After `approved`, the agent:
1. Ensures `app/` exists.
2. Selects a scaffold from `sdd/.agent/scaffolds/` based on app type.
3. Generates the initial structure under `app/`.

### Sprint Loop

Per sprint item:
1. Pick next backlog item.
2. Plan implementation.
3. Apply relevant skill checklists.
4. Implement under `app/`.
5. Run tests; fix failures.
6. Verify build/spec/traceability alignment.
7. Update `progress.md` and `activeContext.md`.
8. Continue until sprint scope is complete.

References:
- `sdd/.agent/rules/workflow/01-sprint-execution.md`
- `sdd/.agent/rules/workflow/02-post-code-verification.md`

## Resolving Ambiguity During Implementation

If implementation reveals ambiguity:
1. Pause the ambiguous part.
2. Record issue in `activeContext.md` (Open Decisions).
3. Propose spec update.
4. Update specs first, then continue coding.
5. If behavioral or mandatory fields change, require re-approval (`approved`).

Reference:
- `sdd/.agent/rules/workflow/00-spec-lifecycle.md`

## Spec Changes After Approval

When requirements/tech choices change:
1. Update relevant specs first.
2. Append to `sdd/memory-bank/core/spec-history.md`.
3. Optionally update spec diff: `bash scripts/spec-diff.sh --update`.
4. Re-run validation.
5. If behavior/mandatory fields changed, ask for re-approval.

## Rollback

- Prefer additive history (`git revert`) over rewriting history.
- Update specs to match intended post-rollback state.
- Record rollback in `sdd/memory-bank/core/spec-history.md`.

## Troubleshooting Snippets

Validation fails repeatedly:
- Run `bash scripts/validate-repo.sh --strict`
- Fix listed issues only.
- Re-run until `Validation: OK`.

Policy check fails in CI:
- Reproduce locally with range args:

```bash
bash scripts/check-policy.sh --base <base_sha> --head <head_sha>
```

Intake resume mismatch:
- Ensure `intake-state.md` includes current phase, missing mandatory answers, and approval status.
