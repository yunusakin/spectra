# Intake Question Contract

This rule defines the canonical format for technical questions and decisions during intake.

## Goal
- Make technical decisions auditable, resumable, and policy-enforceable.
- Prevent silent assumptions before approval.

## Applies To
Use this contract for technical choices in intake, including:
- language / framework / architecture
- datastore / deployment / API style
- auth, authorization, data-access, error model, async model
- any recommendation accepted via discovery mode

Do not use this contract for pure business context fields such as project name or purpose.

## Required Fields Per Technical Question
Every technical question MUST be captured with the fields below.

- `question_id`: stable ID from `05-question-catalog.md`
- `options`: canonical options shown to the user
- `recommended_option`: recommended value and one-line reason
- `user_confirmation`: explicit user response (`confirmed` or `rejected`)
- `final_value`: final selected value written to spec files

## Hard Rules
- Do not write a technical decision to spec files until `user_confirmation` exists.
- If the user rejects the recommendation, record the chosen override as `final_value`.
- If a value is unresolved, add it to `## Open Technical Questions` in `sdd/memory-bank/core/intake-state.md`.
- If unresolved technical questions exist, do not ask for `approved`.

## Decision Logging
Each confirmed technical choice MUST be appended to `## Decision Log` in `sdd/memory-bank/core/intake-state.md`.

Minimum columns:
- Date
- Question ID
- Decision
- Confirmation
- Notes

## Output Example
Use concise bullets or a table row format.

- `question_id`: Q-TECH-001
- `options`: Java, .NET, Go, Node.js, Python, Other
- `recommended_option`: Node.js (shared language with frontend)
- `user_confirmation`: confirmed
- `final_value`: Node.js 22

## Interaction Rules
- Offer 2-3 options with one recommended path when user asks for recommendation.
- Keep recommendations short and concrete.
- Always ask for confirmation before persisting technical choices.
