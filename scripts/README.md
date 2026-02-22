# Scripts

Helper scripts for development and maintenance.

## Conventions
- Small, single-purpose scripts.
- Document inputs, outputs, and side effects at the top of each script.
- Do not write to `app/` unless explicitly intended.

## Available Scripts

| Script | Purpose | When to use |
|--------|---------|-------------|
| `init.sh` | Sets up Spectra in any project (copies files + optional wizard to pre-fill project basics) | Once — when starting a new project |
| `validate-repo.sh` | Validates rule/spec indexes, adapter consistency, skill front matter, skill graph integrity, markdown links/templates | Every push (runs in CI) |
| `check-policy.sh` | Checks approval/open-question/review-gate/invariant/progress policies + skill graph enforcement (`--base/--head` supported) | Every push/PR (runs in CI) |
| `resolve-skills.sh` | Resolves graph-compliant skill order for a task type and validates explicit skill order | Before any post-approval coding |
| `health-check.sh` | Prints a quick project health summary (intake, approval, sprint, tests, spec freshness) | Anytime — run manually for status |
| `spec-diff.sh` | Appends a markdown diff entry for spec changes under `sdd/memory-bank/` | After spec changes, before approval/re-approval |

## Skill Graph Commands

Resolve default order:

```bash
bash scripts/resolve-skills.sh --task-type api-change
```

Validate explicit order:

```bash
bash scripts/resolve-skills.sh --task-type api-db-change --skills db-migration,api-design,testing-plan
```

Non-zero exit means required dependency/order violation.

## `check-policy.sh` Range Mode

Local default mode compares `HEAD~1..HEAD`.

For CI or explicit review ranges:

```bash
bash scripts/check-policy.sh --base <base_sha_or_ref> --head <head_sha_or_ref>
```

This enforces:
- approval gate for app code
- open technical question blockers
- issue reference requirement for open questions
- review-gate severity blockers
- invariant change trail requirement
- progress tracking requirement
- skill graph hard-fail for `app/*` changes

## CI Integration

`.github/workflows/validate.yml` runs:

1. `bash scripts/validate-repo.sh --strict`
2. `bash scripts/check-policy.sh` with CI-provided base/head SHAs
3. `bash scripts/resolve-skills.sh --task-type api-change` (smoke check)
