# Progress

## Done
- Added intake decision governance with new rules:
  - `sdd/.agent/rules/intake/04-question-contract.md`
  - `sdd/.agent/rules/intake/05-question-catalog.md`
- Added role-based quality loop governance:
  - `sdd/.agent/rules/workflow/03-role-loop-gate.md`
  - `sdd/.agent/rules/workflow/04-escalation-policy.md`
- Updated intake/workflow/approval rules to enforce:
  - confirmed technical decisions in `Decision Log`
  - blocking behavior for `Open Technical Questions`
  - blocking behavior for unresolved `critical`/`warning` findings
- Expanded memory-bank schema and references:
  - `sdd/memory-bank/core/intake-state.md` now includes `Decision Log` and `Open Technical Questions`
  - added `sdd/memory-bank/core/invariants.md`
  - added `sdd/memory-bank/core/review-gate.md`
  - updated `sdd/memory-bank/INDEX.md`
- Hardened `scripts/check-policy.sh` with additional checks:
  - open technical question blockers
  - issue reference requirement for open technical questions
  - review-gate severity blockers
  - invariant change trail requirement
  - existing approval/progress/range checks preserved
- Added GitHub issue template for unresolved technical intake decisions:
  - `.github/ISSUE_TEMPLATE/intake-question.yml`
- Aligned docs and adapters with the governance model:
  - `README.md`, `docs/overview.md`, `docs/quick-start.md`, `docs/workflow.md`, `docs/testing.md`, `scripts/README.md`
  - `AGENT.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`
- Added release visibility updates for `v1.0.1` in:
  - `README.md` (`Release History` + `What's New in v1.0.1`)
  - `CHANGELOG.md`
  - `RELEASE_SUMMARY.md`
  - `sdd/memory-bank/core/spec-history.md`

## In Progress
- Running final validation, commit/push, and release publication steps for `v1.0.1`.

## Next
- Complete single commit and push to `main`.
- Publish GitHub release `v1.0.1` using `RELEASE_SUMMARY.md`.
