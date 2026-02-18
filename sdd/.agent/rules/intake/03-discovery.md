# Discovery Mode

## Purpose
When the user is unsure about a technical question, the agent provides contextual recommendations.

## Trigger
Activate when user indicates uncertainty (for example: `recommend`, `not sure`, `you decide`).

## Hard Rules
- Use discovery only for technical/architectural questions.
- Recommendations must be grounded in known project context.
- Present 2-3 options with brief trade-offs.
- Provide one recommended option with short reason.
- Always ask for explicit confirmation before persisting.

## Required Decision Recording
Each discovery decision must be recorded via the intake question contract:
- `question_id`
- options
- recommended option
- user confirmation
- final value

If unresolved after discussion:
- add to `## Open Technical Questions` in `sdd/memory-bank/core/intake-state.md`
- set status to `open`
- attach issue reference

## User Interaction Rules
- User remains in control.
- User can override recommendation at any time.
- User can revisit previous technical decisions during intake.
- Nothing is final until approval.

## Approval Constraint
If any `open` technical question remains:
- do not ask for `approved`
- continue targeted follow-ups until resolved or explicitly deferred with issue tracking
