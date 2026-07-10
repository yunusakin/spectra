# Intake Validation

This rule defines how the agent validates intake answers and generated spec files.

## Goals
- Catch missing mandatory answers before approval.
- Catch inconsistent answers early.
- Ensure technical decisions are explicit, confirmed, and traceable.

## When To Validate
- After each intake phase checkpoint (Phase 1, 2, 2b, 3).
- Before asking for approval.
- When resuming intake.

## Validation Checklist

### 1) Mandatory Answers (Blocking)
Must exist before moving past Phase 1:
- Project name
- Primary purpose/goal
- App type
- Primary language + version
- Framework + version (or `none`)
- Architecture style
- Primary data store + version (or `none`)
- Deployment target
- API style

If missing:
- update `sdd/memory-bank/core/intake-state.md` (phase + missing list + date)
- ask only missing questions

### 2) Question Contract Compliance (Blocking)
For each confirmed technical choice, ensure the following exists in intake tracking:
- `question_id`
- options
- recommended option
- user confirmation
- final value

If any technical choice is unresolved:
- add/update row under `## Open Technical Questions` with status `open`
- include issue reference
- do not proceed to approval

### 3) Choice / Free-Text Normalization (Blocking)
- Non-matching multiple-choice answers are treated as `Other`, then canonicalized.
- If user selected `Other`, persist explicit value, never literal `Other`.

### 4) Cross-Field Consistency (Blocking)
- If `Framework = None` then `Framework version = none`.
- If `Primary data store = None` then `Data store version = none`.
- If `App type = Full-stack`, backend and frontend follow-ups must be answered or explicitly skipped.
- If `API style = Async Messaging`, capture broker + delivery semantics.
- If `API style = gRPC`, capture proto ownership + streaming usage.

### 5) Spec File Presence + Minimum Content (Blocking)
After Phase 1, ensure non-empty content in:
- `sdd/memory-bank/core/projectbrief.md`
- `sdd/memory-bank/tech/stack.md`
- `sdd/memory-bank/arch/patterns-overview.md`
- `sdd/memory-bank/core/intake-state.md`
- `sdd/memory-bank/core/invariants.md`

Before approval:
- No unresolved placeholders (`TBD`, `TODO`, `<...>`) in required specs.
- No `open` technical questions in `intake-state.md`.

## How To Report Errors
When validation fails:
- do not proceed to next phase
- do not ask for approval
- output `Validation errors` with numbered items:
  - what is missing/invalid
  - target file
  - exact follow-up question

Example:
1. Missing `Framework version` (update `sdd/memory-bank/tech/stack.md`).
   Question: What framework version are we using (or reply `none`)?
