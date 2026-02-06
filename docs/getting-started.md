# Getting Started

This guide explains the end-to-end workflow in SDD Spine and shows how the intake, validation, approval gate, and post-approval skills fit together.

## The Workflow (Mermaid)

```mermaid
flowchart TD
  start([Open repo root in your agent]) --> init[User runs init]
  init --> p1[Phase 1 core intake]
  p1 --> ck1[Checkpoint: write specs and update intake state]
  ck1 --> v1{Validate phase 1}
  v1 -- fails --> fix1[Ask only missing or invalid answers]
  fix1 --> ck1
  v1 -- passes --> p2[Phase 2 type specific follow ups]
  p2 --> p2b[Phase 2b API style follow ups if applicable]
  p2b --> p3{Advanced questions}
  p3 -- skip --> ck2[Checkpoint: write specs and update intake state]
  p3 -- answer --> adv[Ask Phase 3 questions in small batches]
  adv --> ck2
  ck2 --> v2{Validate specs}
  v2 -- fails --> fix2[Report validation errors and ask targeted follow ups]
  fix2 --> ck2
  v2 -- passes --> approveQ[Ask for explicit approval: user replies approved]
  approveQ --> approved{Approved}
  approved -- no --> p2
  approved -- yes --> appdir[Ensure app directory exists]
  appdir --> sprint[Create sprint plan files]
  sprint --> skill[Pick skills before coding]
  skill --> code[Generate application code under app only]
  code --> change{Spec change later}
  change -- yes --> spec[Update specs and spec history then validate and reapprove if needed]
  spec --> code
  change -- no --> done([Continue development and release])
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

## Common Mistakes
- Generating code before approval: not allowed (approval gate).
- Skipping validation: the agent should not ask for approval until validation passes.
- Changing a mandatory choice (stack/arch/API style) after approval without re-approval.
