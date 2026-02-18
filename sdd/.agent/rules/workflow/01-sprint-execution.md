# Sprint Execution Loop

This rule defines how the agent works through sprint items after approval.

## Execution Loop (Mandatory After Approval)

After sprint plan creation, the agent follows this loop for each backlog item.

### 1. Pick
- Read `sdd/memory-bank/core/sprint-current.md`.
- Select next item from Sprint Backlog.
- Move it to In Progress.

### 2. Plan
- Create/select a plan template from `sdd/.agent/plans/`.
- Identify relevant skills (`rules/skills/01-skill-auto-select.md`).
- If ambiguous, ask targeted clarification.

### 3. Skill Check
- Apply relevant skill checklist(s) before coding.
- Record applied skills in `progress.md`.

### 4. Code
- Generate code under `app/` following specs and rules.

### 5. Validate
- Run tests and required checks.
- Record findings in `sdd/memory-bank/core/review-gate.md`.

### 6. Challenge
- Run design/assumption challenge pass.
- Record findings in `sdd/memory-bank/core/review-gate.md`.

### 7. Gate
- Apply `03-role-loop-gate.md`.
- If unresolved `critical`/`warning` exists, do not move item to Done.
- Loop back to Code or escalate per `04-escalation-policy.md`.

### 8. Update
- Move item to Done only when gate passes.
- Update `traceability.md` with code + test locations.
- Update `progress.md`.
- Update `activeContext.md`.

### 9. Repeat
- Continue with next item.
- If backlog is empty, summarize sprint outcome.

## When to Break the Loop
- **Blocked**: document blocker in `activeContext.md` Open Decisions and `review-gate.md`.
- **Spec conflict**: follow `00-spec-lifecycle.md` before coding further.
- **Scope creep**: pause and propose scope adjustment.
