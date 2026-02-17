# Documentation Standards

## Mandatory Checks (Agent MUST verify for any deliverable)
- [ ] All spec files live under `sdd/memory-bank/` — no specs in `app/` or the repo root
- [ ] `CHANGELOG.md` is updated for every user-visible change (features, fixes, breaking changes)
- [ ] `RELEASE_SUMMARY.md` is updated before each release with highlights and risks
- [ ] `README.md` accurately reflects the current state of the project (setup, usage, architecture)
- [ ] New modules or significant features have inline doc comments or a dedicated doc under `docs/`
- [ ] No orphan docs: every doc is reachable from an index or README

## When to Report Errors
If any check above fails, the agent MUST:
1. Flag the missing documentation.
2. Propose the minimum content that satisfies the rule.
3. Do not mark the task as complete until docs are updated.

## Reference
- Prompts: `sdd/.agent/prompts/docs/`
