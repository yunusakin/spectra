# Scripts

Helper scripts for development and maintenance.

## Conventions
- Small, single-purpose scripts.
- Document inputs, outputs, and side effects at the top of each script.
- Do not write to `app/` unless explicitly intended.

## Available Scripts

| Script | Purpose | When to use |
|--------|---------|-------------|
| `validate-repo.sh` | Validates rule/spec indexes, adapter consistency, skills front matter, markdown templates | Every push (runs in CI) |
| `check-policy.sh` | Checks approval gate invariants and progress tracking | Every push (runs in CI) |
| `health-check.sh` | Prints a quick project health summary (intake, approval, sprint, tests, spec freshness) | Anytime — run manually for a status check |
| `spec-diff.sh` | Appends a markdown diff entry for spec changes under `sdd/memory-bank/` | After spec changes, before approval |

## CI Integration

Both `validate-repo.sh` (strict mode) and `check-policy.sh` run automatically on push and pull request via `.github/workflows/validate.yml`.
