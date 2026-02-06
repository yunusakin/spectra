# Getting Started

This guide explains the end-to-end workflow in SDD Spine and shows how the intake, validation, approval gate, and post-approval skills fit together.

## Workflow Scenarios (Mermaid)

The diagrams below are intentionally split by scenario so each stays readable. The README keeps only the "at a glance" version.

### Scenario 1: Happy Path (Init -> Intake -> Validate -> Approved)

```mermaid
flowchart TD
  A[Pick an agent adapter] --> B[Run init]
  B --> C[Answer intake questions]
  C --> D{Validation passes}
  D -- no --> C
  D -- yes --> E[Reply approved]
  E --> F[Generate code under app only]
```

### Scenario 2: Validation Fails (Targeted Fix Loop)

```mermaid
flowchart TD
  A[Run init] --> B[Answer questions]
  B --> C{Validation passes}
  C -- no --> D[Agent reports missing or invalid fields]
  D --> B
  C -- yes --> E[Continue intake phases]
```

### Scenario 3: After Approval (Spec Change)

```mermaid
flowchart TD
  A[Need a change] --> B[Update specs first]
  B --> C[Record spec history]
  C --> D[Validate specs]
  D --> E{Re approval needed}
  E -- yes --> F[Ask for approval again]
  F --> G{Approved}
  G -- no --> B
  G -- yes --> H[Update code under app]
  E -- no --> H
```

## Quick Checklist

1. Start intake: user types `init`.
2. Answer Phase 1 questions (Core).
3. Agent checkpoints by updating specs under `sdd/memory-bank/` and `sdd/memory-bank/core/intake-state.md`.
4. Agent validates (`sdd/.agent/rules/intake/02-validation.md`).
5. Continue Phase 2 / Phase 2b, optionally skip Phase 3.
6. When validation passes, agent asks for approval (reply `approved`).
7. After approval: code goes under `app/` only, and the agent selects a skill workflow.

## Key Files To Know
- Intake flow + questions:
  - `sdd/.agent/rules/intake/00-intake-flow.md`
  - `sdd/.agent/rules/intake/01-questions.md`
- Validation:
  - `sdd/.agent/rules/intake/02-validation.md`
- Resume:
  - `sdd/memory-bank/core/intake-state.md`
- Spec change tracking:
  - `sdd/memory-bank/core/spec-history.md`
- Post-approval skills:
  - `sdd/.agent/skills/USAGE.md`

## Example Scenarios
- Backend API: [`docs/examples/backend-api-orders-service.md`](docs/examples/backend-api-orders-service.md)
- Worker: [`docs/examples/worker-billing-reconciler.md`](docs/examples/worker-billing-reconciler.md)
- CLI tool: [`docs/examples/cli-reporting-tool.md`](docs/examples/cli-reporting-tool.md)

## Common Mistakes
- Generating code before approval: not allowed (approval gate).
- Skipping validation: the agent should not ask for approval until validation passes.
- Changing a mandatory choice (stack/arch/API style) after approval without re-approval.
