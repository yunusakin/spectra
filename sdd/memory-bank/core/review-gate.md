# Review Gate

> Tracks validation/challenge findings and their resolution state.

## Findings

| Date | Scope | Source | Severity | Status | Owner | Note |
|---|---|---|---|---|---|---|

<!--
Example:
| 2026-02-18 | orders-api | validation | warning | open | validation-agent | Missing retry on upstream timeout |
| 2026-02-18 | orders-api | challenge | critical | resolved | coding-agent | Added idempotency guard and tests |
-->

## Gate Rules
- Any unresolved `critical` or `warning` blocks stable status.
- `note` items may remain open but should be tracked.
- Escalated items must include a clear decision request.
