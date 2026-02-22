---
name: db-migration
description: Plan and implement database schema changes. Use when adding tables/columns/indexes or changing data models.
task_types: db-change,api-db-change,full-stack-change
---

# DB Migration Skill

## Purpose
Plan safe schema changes with validation and rollback steps.

## Inputs
- Target schema changes
- Data volume and migration risks
- Downtime tolerance
- Target environments

## Steps
1. Describe schema changes and migration order.
2. Evaluate backward compatibility and rolling deployment needs.
3. Define data backfill or transformation steps.
4. Add or update indexes for query paths.
5. Define rollback strategy and failure handling.
6. Specify verification queries and acceptance checks.
7. Identify required tests and staging validation.

## Outputs
- Migration plan in `sdd/.agent/plans/plan-migration-template.md`
- Updates to `sdd/memory-bank/tech/stack.md` if needed
- Updates to `CHANGELOG.md` if schema is externally visible

## Checklist
- [ ] Migration order documented
- [ ] Backward compatibility assessed
- [ ] Indexes defined
- [ ] Rollback plan documented
- [ ] Verification queries listed
- [ ] Tests and staging validation planned

## Example Input
- Add column `status` to `orders`
- Backfill existing rows with "pending"

## Example Output
- Migration plan with backfill step
- Rollback: drop column if safe

