# Database Standards

## Mandatory Checks (Agent MUST verify before generating DB code)
- [ ] All schema changes use versioned migrations (never raw DDL in application code)
- [ ] Each migration has a rollback/down step documented
- [ ] Indexes are defined for columns used in WHERE, JOIN, and ORDER BY clauses
- [ ] Transactions wrap operations that require atomicity (multi-table writes, balance changes)
- [ ] Naming is consistent: `snake_case` for tables and columns, plural table names
- [ ] Nullable vs NOT NULL is explicitly decided for every column (no implicit defaults)
- [ ] Large data changes include a backfill plan with estimated duration

## When to Report Errors
If any check above fails, the agent MUST:
1. Stop code generation for that migration or query.
2. Report the violation with the specific rule that failed.
3. Wait for confirmation before proceeding.

## Reference
- Skill: `sdd/.agent/skills/db-migration/SKILL.md`
