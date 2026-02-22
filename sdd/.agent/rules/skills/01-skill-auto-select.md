# Skill Auto-Selection

When the agent is about to implement a task (post-approval), it MUST classify the task and apply the relevant skill checklist(s) **before writing code**.

## Mandatory Contract

1. Classify the implementation item into a `task_type`.
2. Run `bash scripts/resolve-skills.sh --task-type <task_type>`.
3. Use the reported `Recommended Order` as execution order.
4. If overriding with explicit skills, validate with:
   - `bash scripts/resolve-skills.sh --task-type <task_type> --skills <csv>`
5. If resolver returns non-zero, do not proceed to coding.

Canonical dependency source:
- `sdd/.agent/skills/dependency-map.tsv`

## Task Type Mapping

| Task type | Typical scope | Baseline skills |
|---|---|---|
| `api-change` | Endpoints/contracts/errors/pagination | `api-design`, `security-review-lite`, `testing-plan` |
| `db-change` | Schema/index/migration changes | `db-migration`, `testing-plan`, `ops-deploy` |
| `api-db-change` | API + DB together | `db-migration`, `api-design`, `security-review-lite`, `testing-plan`, `ops-deploy` |
| `security-change` | Auth/PII/secrets/exposure hardening | `security-review-lite`, `testing-plan` |
| `deploy-change` | Env/rollout/health/rollback | `ops-deploy`, `testing-plan` |
| `release` | Release packaging and readiness | `testing-plan`, `ops-deploy`, `release-prep` |
| `full-stack-change` | Broad cross-area implementation | `db-migration`, `api-design`, `security-review-lite`, `testing-plan`, `ops-deploy`, `release-prep` |
| `bugfix` | Focused fix | `testing-plan` |

## Recording (Required)

For each implementation item, append one row to:
- `sdd/memory-bank/core/skill-runs.md`

Minimum row fields:
- Date
- Item
- Task Type
- Selected Skills
- Execution Order
- Result
- Notes

Also summarize applied skills and decisions in:
- `sdd/memory-bank/core/progress.md`

## Multi-Area Tasks

If a task touches multiple areas:
1. Prefer `task_type: api-db-change` or `full-stack-change`.
2. Resolve order via `resolve-skills.sh`.
3. Complete each skill checklist in the resolved order.

## When Uncertain

If classification is ambiguous:
1. Propose likely `task_type` values to the user.
2. Wait for confirmation.
3. Then run resolver and continue.
