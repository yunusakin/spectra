# Workflow Guide

How to resume intake, execute sprints after approval, apply quality gates, and escalate safely.

## Resume Intake

- Intake progress is tracked in `sdd/memory-bank/core/intake-state.md`.
- If intake is interrupted, run `init` again.
- Ask only missing mandatory answers first, then continue phase flow.

## Intake Decision Loop

For every technical question:
1. Ask with stable `question_id`.
2. Present options and recommendation.
3. Capture explicit user confirmation.
4. Persist final value to specs.
5. Append to `Decision Log`.

If unresolved:
- add row to `Open Technical Questions` (`status: open` + issue reference)
- block approval until resolved

## After `approved`

### Scaffolding

After `approved`, the agent:
1. Ensures `app/` exists.
2. Selects a scaffold from `sdd/.agent/scaffolds/`.
3. Generates initial structure under `app/`.

### Role-Based Quality Loop

Per implementation item:
1. Coding pass.
2. Validation pass.
3. Challenge pass.
4. Resolve findings and repeat if needed.

Blocking rule:
- unresolved `critical` or `warning` findings mean item is not stable.

Record findings in `sdd/memory-bank/core/review-gate.md`.

## Escalation Rules

- Max correction iterations per blocked item: `3`.
- If still blocked:
  - pause blocked scope
  - log blocker in `activeContext.md`
  - mark blocker in `review-gate.md`
  - request human decision

## Spec Changes After Approval

When requirements/tech choices change:
1. Update specs first.
2. Append to `sdd/memory-bank/core/spec-history.md`.
3. Optionally run `bash scripts/spec-diff.sh --update`.
4. Re-run validation/policy checks.
5. If behavior or mandatory fields changed, require re-approval.

## Rollback

- Prefer additive history (`git revert`) over rewriting history.
- Update specs to intended post-rollback state.
- Record rollback in `sdd/memory-bank/core/spec-history.md`.

## Troubleshooting Snippets

Policy check fails in CI:

```bash
bash scripts/check-policy.sh --base <base_sha> --head <head_sha>
```

Intake blocked before approval:
- Resolve all `open` technical questions.
- Resolve all unresolved `critical`/`warning` findings.
- Re-run `validate-repo.sh --strict` and `check-policy.sh`.
