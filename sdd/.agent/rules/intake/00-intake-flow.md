# Intake Flow

## Trigger
- Start intake when the user message is exactly `init`.

## Hard Rules
- Do not generate application code before explicit approval.
- All application code must be generated under `app/` only.
- If `app/` directory does not exist, create it after receiving approval.
- Specs and decisions live under `sdd/memory-bank/`.
- Technical decisions must follow `04-question-contract.md` and use IDs from `05-question-catalog.md`.

## Mandatory Questions
These must be answered before proceeding past Phase 1:
- Project name
- Primary purpose/goal
- App type
- Primary language + version
- Framework + version (or none)
- Architecture style
- Primary data store + version (or none)
- Deployment target
- API style

## Progressive Disclosure (Required)
Run intake in phases:
1. Phase 1 (Core): mandatory questions.
2. Phase 2 (Type-specific): only app-type relevant follow-ups.
3. Phase 2b (API-style): only API-style relevant follow-ups.
4. Phase 3 (Advanced, optional): quality/security/ops/NFR details.

After each phase:
- Update relevant spec files.
- Update `sdd/memory-bank/core/intake-state.md`.
- Run validation via `02-validation.md`.

## Context Loading (Token Budget)
- Follow `sdd/.agent/runtime/minimal.md`.
- Use `01-questions.md` as router only.
- Load only one relevant intake question pack at a time from `rules/intake/questions/`.

## Question Rules
- Keep question batches small (<= 10 per turn).
- If user is uncertain on a technical choice, activate discovery mode (`03-discovery.md`).
- Do not persist technical choices without explicit confirmation.
- Every confirmed technical choice must be appended to `## Decision Log` in `intake-state.md`.
- Unresolved technical choices must be recorded in `## Open Technical Questions` with status `open`.

## Discovery Announcement
Before technical questions:
> "We're moving to technical questions now. If you're unsure about any answer, just say **'recommend'** and I'll suggest the best option based on your project."

Do not repeat this announcement.

## Where to Write Answers
- Overview/requirements/constraints: `sdd/memory-bank/core/projectbrief.md`
- Tech stack: `sdd/memory-bank/tech/stack.md`
- Architecture: `sdd/memory-bank/arch/patterns-overview.md`
- Invariants: `sdd/memory-bank/core/invariants.md`
- Intake progress + decisions: `sdd/memory-bank/core/intake-state.md`
- Current status: `sdd/memory-bank/core/activeContext.md`

## Checkpointing / Resume
After each user response during intake, update `intake-state.md` with:
- current phase
- phase completion checkboxes
- missing mandatory answers
- validation errors
- approval status (`not approved` until explicit approval)
- decision log entries for confirmed technical choices
- open technical questions for unresolved technical choices
- last updated date

If user runs `init` again and specs already contain partial answers:
1. Ask only missing mandatory fields first.
2. Then continue from the next smallest relevant batch.

## Stop for Approval
After writing specs, run validation (`02-validation.md`).
Only if validation passes AND there are no open technical questions:
- stop and ask for explicit approval.

## After Approval
When the user replies `approved`:
1. Set `## Approval Status` in `sdd/memory-bank/core/intake-state.md` to `approved`.
2. Ensure there are no `open` technical questions.
3. Create `app/` if missing.
4. Generate application code only under `app/`.
5. Say "I will create sprint plan" and populate sprint files.
