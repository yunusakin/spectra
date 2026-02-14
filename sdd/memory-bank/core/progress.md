# Progress

## Done
- Refreshed onboarding docs for clarity and consistency across `README.md`, `docs/overview.md`, `docs/quick-start.md`, `docs/getting-started.md`, `docs/workflow.md`, and `docs/testing.md`.
- Added a single high-level flow in `README.md`, plus a concrete "First 10 Minutes" command path and troubleshooting snippets.
- Hardened `scripts/check-policy.sh` with range-aware checks (`--base`/`--head`) and explicit approval-status parsing from `sdd/memory-bank/core/intake-state.md`.
- Updated CI in `.github/workflows/validate.yml` to run strict validation and pass explicit range SHAs to policy checks.
- Added canonical `## Approval Status` guidance in intake/approval/workflow rules and the `sdd/memory-bank/core/intake-state.md` template.

## In Progress
- None.

## Next
- Review wording and examples with the team for any preferred terminology tweaks.
- Commit and push this docs + policy hardening pass if accepted.

<!--
Example (remove when using):
## Done
- Completed intake Phase 1 (project brief, stack, architecture).
- Implemented user authentication module under `app/src/auth/`.

## In Progress
- Building order creation endpoint (`POST /api/orders`).

## Next
- Add integration tests for order creation.
- Set up CI pipeline.
-->
