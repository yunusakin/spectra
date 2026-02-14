# Scripts

Helper scripts for development and maintenance.

## Conventions
- Small, single-purpose scripts.
- Document inputs, outputs, and side effects at the top of each script.
- Do not write to `app/` unless explicitly intended.

## Available Scripts

| Script | Purpose | When to use |
|--------|---------|-------------|
| `validate-repo.sh` | Validates rule/spec indexes, adapter consistency, skills front matter, markdown links/templates | Every push (runs in CI) |
| `check-policy.sh` | Checks approval-gate invariants and progress tracking (`--base/--head` supported) | Every push/PR (runs in CI) |
| `health-check.sh` | Prints a quick project health summary (intake, approval, sprint, tests, spec freshness) | Anytime — run manually for status |
| `spec-diff.sh` | Appends a markdown diff entry for spec changes under `sdd/memory-bank/` | After spec changes, before approval/re-approval |

## `check-policy.sh` Range Mode

Local default mode compares `HEAD~1..HEAD`.

For CI or explicit review ranges:

```bash
bash scripts/check-policy.sh --base <base_sha_or_ref> --head <head_sha_or_ref>
```

This enforces progress-tracking and policy checks across the full provided range.

## CI Integration

`.github/workflows/validate.yml` runs:

1. `bash scripts/validate-repo.sh --strict`
2. `bash scripts/check-policy.sh` with CI-provided base/head SHAs
