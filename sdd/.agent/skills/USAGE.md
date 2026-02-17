# Skills Usage Guide

Skills are reusable workflows for common engineering tasks (API design, DB migrations, deployment planning, etc.). They help agents and humans follow consistent steps and produce consistent outputs.

## When To Use Skills
- Use skills **after approval** to guide implementation work.
- You may also apply a skill to **spec work** (before approval), but you must still respect the approval gate: do not generate application code before approval.

## How To Pick a Skill
Start from the change you are about to make:

| If you are... | Use skill |
|---|---|
| Designing/changing endpoints, contracts, errors, pagination | `api-design` |
| Changing schema (tables/columns/indexes), backfills | `db-migration` |
| Planning rollout, env vars, health checks, rollback | `ops-deploy` |
| Preparing a release (notes, risks, readiness) | `release-prep` |
| Doing a quick security checklist (auth, PII, secrets) | `security-review-lite` |
| Defining test layers/coverage/CI gates | `testing-plan` |

## Common Skill Combinations
These are "good defaults" (not hard requirements).

### Add or Change an API Endpoint
1. `api-design`
2. `security-review-lite` (if auth/PII/external exposure)
3. `testing-plan`
4. `ops-deploy` (if new config/rollout impact)
5. `release-prep` (before shipping)

### Add a DB Schema Change
1. `db-migration`
2. `testing-plan`
3. `ops-deploy`
4. `release-prep`

### Prepare a Release
1. `release-prep`
2. Optionally: `security-review-lite`, `testing-plan`, `ops-deploy` depending on the changes

## Dependency Graph (Suggested)
See `sdd/.agent/skills/dependency-graph.md`.

## Prompts vs Skills
- Skills are end-to-end workflows (inputs -> steps -> outputs).
- Prompts are reusable checklists/templates. See `sdd/.agent/prompts/USAGE.md`.

