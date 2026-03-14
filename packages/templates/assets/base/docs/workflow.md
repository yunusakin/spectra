# Workflow Guide

How to resume intake, execute sprints after approval, apply quality gates, and escalate safely.

## Resume Intake

- Intake progress is tracked in `sdd/memory-bank/core/intake-state.md`.
- If intake is interrupted, run `init` again.
- Ask only missing mandatory answers first, then continue phase flow.
- Use `spectra ctx --role planner --goal decide` to load only the required files.

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

## After `implementation-approved`

### Scaffolding

After `implementation-approved`, Spectra:
1. Ensures `app/` exists.
2. Selects a scaffold from `sdd/system/scaffolds/`.
3. Generates initial structure under `app/`.

Before coding a task:
1. Capture intent with `spectra task --item <id> --task-type <type> --goal "<goal>"`.
2. Review `sdd/memory-bank/core/implementation-brief.md`.
3. Load implementation context with `spectra ctx --role implementer --goal implement`.

### Skill Graph Loop (Before Coding)

For each implementation item:
1. Classify task type (`api-change`, `db-change`, `api-db-change`, etc.).
2. Resolve skill order:
   - `spectra skills --task-type <task_type>`
3. If using explicit skills/order, validate with:
   - `spectra skills --task-type <task_type> --skills <csv>`
4. Append run log row to `sdd/memory-bank/core/skill-runs.md`.

Blocking rule:
- non-zero resolver exit means no coding yet.

### Role-Based Quality Loop

Per implementation item:
1. Coding pass.
2. Validation pass.
3. Challenge pass.
4. Resolve findings and repeat if needed.

Blocking rule:
- unresolved `critical` or `warning` findings mean item is not stable.

Record findings in `sdd/memory-bank/core/review-gate.md`.

### Verify Work

Before marking an item ready:
1. Run `spectra ver --scope app` for implementation work.
2. Run `spectra ver --scope spec` for spec-only work.
3. Fix blockers before handoff.
4. Use `spectra ctx --role verifier --goal verify` when you need compact verification context.
5. For release confidence, run `spectra ver --profile release` before `spectra ap --stage release-approved`.

### Quick Lane

For docs/rules/spec/ops work with no `app/*` changes:

```bash
spectra q --type docs --task "refresh workflow docs"
```

If `app/*` changes are detected, quick lane exits non-zero and the full workflow is required.

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
3. Optionally run `spectra diff update`.
4. Re-run validation/policy checks.
5. If behavior or mandatory fields changed, require re-approval.

## Rollback

- Prefer additive history (`git revert`) over rewriting history.
- Update specs to intended post-rollback state.
- Record rollback in `sdd/memory-bank/core/spec-history.md`.

## Troubleshooting Snippets

Policy check fails in CI:

```bash
spectra val --base <base_sha> --head <head_sha>
```

Skill graph order fails:

```bash
spectra skills --task-type <task_type> --skills <csv>
```

Then use returned `Recommended Order` and log in `skill-runs.md`.

Intake blocked before approval:
- Resolve all `open` technical questions.
- Resolve all unresolved `critical`/`warning` findings.
- Re-run `spectra val`.
