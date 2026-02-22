# Skills Usage Guide

Skills are reusable workflows for common engineering tasks (API design, DB migrations, deployment planning, etc.). They help agents and humans follow consistent steps and produce consistent outputs.

## When To Use Skills
- Use skills **after approval** to guide implementation work.
- You may also apply a skill to **spec work** (before approval), but you must still respect the approval gate: do not generate application code before approval.

## Skill Graph Contract (Enforced)

Skill ordering is policy-enforced for implementation work touching `app/`.

Canonical files:
- Visual graph: `sdd/.agent/skills/dependency-graph.md`
- Machine-readable graph: `sdd/.agent/skills/dependency-map.tsv`
- Run log: `sdd/memory-bank/core/skill-runs.md`

Before coding, run:

```bash
bash scripts/resolve-skills.sh --task-type <task_type>
```

If you provide explicit skills/order, validate it:

```bash
bash scripts/resolve-skills.sh --task-type <task_type> --skills <csv>
```

A non-zero exit is blocking.

## How To Pick a Skill
Start from task type classification:

| Task type | Use baseline |
|---|---|
| `api-change` | `api-design`, `security-review-lite`, `testing-plan` |
| `db-change` | `db-migration`, `testing-plan`, `ops-deploy` |
| `api-db-change` | `db-migration`, `api-design`, `security-review-lite`, `testing-plan`, `ops-deploy` |
| `security-change` | `security-review-lite`, `testing-plan` |
| `deploy-change` | `ops-deploy`, `testing-plan` |
| `release` | `testing-plan`, `ops-deploy`, `release-prep` |
| `full-stack-change` | `db-migration`, `api-design`, `security-review-lite`, `testing-plan`, `ops-deploy`, `release-prep` |
| `bugfix` | `testing-plan` |

## Logging (Required)

Each implementation item must append a row to:
- `sdd/memory-bank/core/skill-runs.md`

Minimum fields:
- Date
- Item
- Task Type
- Selected Skills
- Execution Order
- Result
- Notes

Also summarize applied skills in:
- `sdd/memory-bank/core/progress.md`

## Dependency Graph (Suggested Visual)
See `sdd/.agent/skills/dependency-graph.md`.

## Prompts vs Skills
- Skills are end-to-end workflows (inputs -> steps -> outputs).
- Prompts are reusable checklists/templates. See `sdd/.agent/prompts/USAGE.md`.
