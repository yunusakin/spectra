# Escalation Policy

This rule defines when the agent must stop looping and escalate.

## Max Iterations
- Maximum correction iterations per blocked item: `3`

## Escalation Trigger
Escalate when any condition is true:
- Iteration count reached `3` and blocking findings remain
- Conflicting requirements cannot be resolved safely
- Missing decision blocks architecture or security-critical behavior

## Escalation Actions (Mandatory)
1. Stop implementation for the blocked scope.
2. Add an escalation note to `sdd/memory-bank/core/activeContext.md` under Open Decisions.
3. Add or update a row in `sdd/memory-bank/core/review-gate.md` with status `blocked`.
4. Summarize options and risks for human decision.
5. Resume only after explicit user guidance.

## Logging
Also append a concise entry in `sdd/memory-bank/core/progress.md` noting:
- what blocked progress
- what options were presented
- what decision is needed
