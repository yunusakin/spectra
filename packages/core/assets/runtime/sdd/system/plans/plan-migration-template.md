# Migration Plan Template

## Goal
<!-- What schema/data change and why. -->

## Scope
<!-- Tables, columns, indexes affected. -->

## Data Model Changes
<!-- Before/after comparison. Use a table or diff block. -->
| Table | Column | Before | After |
|-------|--------|--------|-------|
|       |        |        |       |

## Migration Steps
<!-- Numbered steps with estimated duration. Include data backfill if needed. -->
1.
2.
3.

## Backward Compatibility
<!-- Can the old code run against the new schema during rolling deployment? If not, describe the sequencing. -->

## Validation Plan
<!-- Queries or checks to confirm the migration succeeded. -->
- [ ] Row counts match expectations
- [ ] Indexes perform as expected (EXPLAIN output)
- [ ] Application smoke test passes

## Rollback Strategy
<!-- How to undo the migration — drop column, restore backup, revert migration file. -->

## Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
|      |           |            |
