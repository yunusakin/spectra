# Sprint Execution Loop

This rule defines how the agent works through sprint items after approval. It ensures systematic, traceable progress.

## Execution Loop (Mandatory After Approval)

After sprint plan creation, the agent follows this loop for each backlog item:

### 1. Pick
- Read `sdd/memory-bank/core/sprint-current.md`.
- Select the next item from **Sprint Backlog** (top to bottom).
- Move it to **In Progress**.

### 2. Plan
- Create or select a plan template from `sdd/.agent/plans/`.
- Identify which skills apply (see `sdd/.agent/rules/skills/01-skill-auto-select.md`).
- If the task is ambiguous, ask the user for clarification before proceeding.

### 3. Skill Check
- Apply the relevant skill checklist(s) before writing code.
- Record which skills were applied in `progress.md`.

### 4. Code
- Generate code under `app/` following the plan and skill outputs.
- Follow the domain rules in `sdd/.agent/rules/` (API, DB, security, testing, etc.).

### 5. Test
- Write tests for the new/changed functionality.
- Run tests and confirm they pass.
- If tests fail, fix the code before proceeding.

### 6. Verify
- Follow `sdd/.agent/rules/workflow/02-post-code-verification.md`.
- Cross-check against specs in `projectbrief.md`.

### 7. Update
- Move the item from **In Progress** → **Done** in `sprint-current.md`.
- Update `sdd/memory-bank/core/traceability.md` with code + test locations.
- Update `sdd/memory-bank/core/progress.md`.
- Update `sdd/memory-bank/core/activeContext.md` (Recent Changes + Current Focus).

### 8. Repeat
- Return to step 1 for the next item.
- When Sprint Backlog is empty, summarize the sprint in `progress.md` and ask the user about next steps.

## When to Break the Loop
- **Blocked**: If a task requires a user decision, document it in `activeContext.md` → Open Decisions and ask the user.
- **Spec conflict**: If coding reveals a spec issue, follow the discovery protocol in `00-spec-lifecycle.md`.
- **Scope creep**: If the task grows beyond what was planned, stop and propose a scope adjustment.
