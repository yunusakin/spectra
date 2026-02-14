# Active Context

> Auto-maintained by the agent. Read this first when resuming work.

## Current Focus
- Spectra documentation clarity and policy/CI reliability hardening.

## Recent Changes
| File | Change |
|------|--------|
| `README.md` | Reframed onboarding flow, added one high-level diagram, commands, and troubleshooting. |
| `scripts/check-policy.sh` | Added `--base`/`--head` range mode and explicit `Approval Status` parsing. |
| `.github/workflows/validate.yml` | Strict validation + range-aware policy checks using CI SHAs. |
| `sdd/memory-bank/core/intake-state.md` | Added canonical `## Approval Status` field in template. |
| `sdd/.agent/rules/approval/00-approval-gate.md` | Aligned approval/re-approval behavior with explicit approval status updates. |

## Open Decisions
- None currently blocked. Awaiting user review for wording/style preferences.

## Session Boundary
- All planned Balanced/Medium updates were implemented across docs, rules, policy script, and CI workflow.
- Verification ran for strict validation and policy checks (including range-aware pass/fail and approval-gate fail/pass simulations).
- Next action: review diffs, then commit/push if approved.
