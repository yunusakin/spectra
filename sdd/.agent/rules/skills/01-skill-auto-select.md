# Skill Auto-Selection

When the agent is about to implement a task (post-approval), it MUST classify the task and apply the relevant skill checklist(s) **before writing code**.

## Classification Rules

| If the task involves... | Apply skill | Required? |
|---|---|---|
| Designing or changing API endpoints, contracts, errors, pagination | `api-design` | Yes |
| Changing database schema, adding tables/columns/indexes, backfills | `db-migration` | Yes |
| Handling auth, PII, secrets, or exposing external APIs | `security-review-lite` | Yes |
| Any code change (always) | `testing-plan` (checklist only) | Yes |
| Preparing deployment, env vars, health checks, rollout | `ops-deploy` | If deployment is in scope |
| Preparing a release | `release-prep` | If releasing |

## Multi-Area Tasks

If a task touches multiple areas (e.g., new API + DB migration):
1. Apply skills in dependency-graph order (see `sdd/.agent/skills/dependency-graph.md`).
2. Complete each skill's checklist before moving to the next.
3. Typical order: `db-migration` → `api-design` → `security-review-lite` → `testing-plan` → `ops-deploy` → `release-prep`.

## Recording

After applying skills, record in `sdd/memory-bank/core/progress.md`:
- Which skills were applied.
- Any issues or decisions surfaced by the skill checklists.

## When Uncertain

If the task classification is ambiguous:
1. Propose the best-match skill(s) to the user.
2. Wait for confirmation before proceeding.
