# Intake Validation

This rule defines how the agent validates intake answers and the generated spec files.

## Goals
- Catch missing mandatory answers early (before approval).
- Catch inconsistent answers (e.g., `Framework: None` but a framework version is provided).
- Keep spec files readable and consistent so humans can review them quickly.

## When To Validate
- After every intake phase checkpoint (Phase 1, Phase 2, Phase 2b, Phase 3).
- Before asking for approval.
- When resuming intake (user runs `init` again).

## Validation Checklist

### 1) Mandatory Answers (Blocking)
These must exist before moving past Phase 1:
- Project name
- Primary purpose/goal
- App type
- Primary language + version
- Framework + version (or "none")
- Architecture style
- Primary data store + version (or "none")
- Deployment target
- API style

If any are missing:
- Update `sdd/memory-bank/core/intake-state.md`:
  - set current phase
  - list missing mandatory answers
  - set last updated date
- Ask only the missing questions (do not proceed to Phase 2/3).

### 2) Choice / Free-Text Normalization (Blocking)
- For multiple-choice questions, if the user answer does not match an option, treat it as `Other` and ask for a single canonical value to write into specs.
- If the user selects `Other`, capture the exact free-text value in the spec (do not leave it as "Other").

### 3) Cross-Field Consistency (Blocking)
Enforce these consistency rules:
- If `Framework = None` then `Framework version = none`.
- If `Primary data store = None` then `Data store version = none`.
- If `App type = Full-stack`, ensure both backend and frontend follow-ups are either answered or explicitly skipped.
- If `API style = Async Messaging`, ensure Phase 2b captures broker + delivery semantics (or explicitly states why not).
- If `API style = gRPC`, ensure Phase 2b captures proto ownership + streaming usage (or explicitly states why not).

If inconsistencies exist:
- Report them as validation errors (see "How To Report Errors") and ask targeted follow-ups.

### 4) Spec File Presence + Minimum Content (Blocking)
After Phase 1, ensure these files are updated with non-empty, human-readable content (not just templates/examples):
- `sdd/memory-bank/core/projectbrief.md` (Project name, Purpose, App type)
- `sdd/memory-bank/tech/stack.md` (Language, Framework, Data store + versions)
- `sdd/memory-bank/arch/patterns-overview.md` (Architecture style)
- `sdd/memory-bank/core/intake-state.md`

After Phase 2, additionally ensure:
- `sdd/memory-bank/core/projectbrief.md` includes top features / scope and key constraints (deployment/security/org).

Before asking for approval, also sanity check:
- No unresolved placeholders like `TBD`, `TODO`, or `<...>` in the required spec files (unless inside an example comment).
- The chosen architecture style is explicitly written (not only implied).

## How To Report Errors (Agent Output)
When validation fails:
- Do not proceed to the next phase and do not ask for approval.
- Output a short section titled `Validation errors` with a numbered list.
- Each item must include:
  - what is missing/invalid
  - which spec file will be updated
  - the exact follow-up question(s) the user should answer

Example format:
1. Missing `Framework version` (will update `sdd/memory-bank/tech/stack.md`).
   Question: What framework version are we using (or reply `none`)?

