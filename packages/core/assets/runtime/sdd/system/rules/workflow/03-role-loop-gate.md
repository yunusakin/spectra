# Role Loop Gate

This rule defines the required quality loop before a module can be treated as stable.

## Sequence (Mandatory)
For every meaningful implementation item:
1. Coding pass
2. Validation pass
3. Challenge pass

Do not skip the sequence.

## Severity Model
- `critical`: blocks progression
- `warning`: blocks stable status until resolved
- `note`: non-blocking improvement

## Stable Criteria
A module/item can be considered stable only when:
- No unresolved `critical` findings exist
- No unresolved `warning` findings exist
- Acceptance criteria are met
- Traceability references are updated

## Recording Location
Write findings and resolution status in `sdd/memory-bank/core/review-gate.md`.

## Hard Stop
If unresolved `critical` or `warning` exists:
- Do not mark stable
- Do not close the item
- Continue correction loop or escalate per `04-escalation-policy.md`
