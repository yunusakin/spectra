# Intake Flow

## Trigger
- Start intake when the user message is exactly `init`.

## Hard Rules
- Do not generate application code before explicit approval.
- All application code must be generated under `app/` only.
- If `app/` directory does not exist, create it after receiving approval.
- Specs and decisions live under `sdd/memory-bank/`.

## Mandatory Questions
These must be answered before proceeding:
- Project name
- Primary purpose/goal
- App type (Backend / Web / Full-stack / Mobile / CLI / Worker / Library / Other)
- Primary language + version
- Framework + version (or none)
- Architecture style (Layered / Hexagonal / CQRS / Microservices / Other)
- Primary data store + version (or none)
- Deployment target (Local / Docker / K8s / Cloud / On-prem / Other)
- API style (REST / GraphQL / gRPC / Async / Other)

## Progressive Disclosure (Required)
Run intake in phases to reduce user fatigue:
1. Phase 1 (Core): mandatory questions only.
2. Phase 2 (Type-specific): ask only the follow-ups relevant to the chosen App Type and API style.
3. Phase 3 (Advanced, optional): quality, security, ops, and non-functional targets.

After each phase, checkpoint by updating spec files. This enables resume if intake is interrupted.

## Question Rules
- Keep each question batch small (aim for <= 10 questions per turn).
- If a phase has > 10 questions, split it into multiple turns (e.g., Phase 1a / 1b).
- Prefer "answer in bullets" prompts and accept partial answers; then ask the next smallest relevant batch.
- After Phase 2, explicitly offer to continue with Phase 3 or skip advanced questions.
- Every multiple-choice question must include an `Other` option.
- If a free-text answer is blank, omit that section from docs.
- Free-text answers may use Markdown; keep it concise and prefer bullets.

## Conditional Follow-ups
Based on App Type, ask only the relevant follow-up section from `01-questions.md`:
- Backend API / Full-stack (backend): API surface, auth, data access, error model, async needs.
- Web (frontend only): routes/pages, browsers, hosting, design system, accessibility.
- Mobile: platform(s), framework, distribution, offline, push, device capabilities.
- CLI: commands, flags, output formats, OS support, distribution.
- Worker/Batch: trigger/schedule, retries, idempotency, concurrency, DLQ.
- Library/SDK: public API, packaging, compatibility, versioning, examples.

Additionally, apply API-style follow-ups:
- REST: versioning, error model, pagination/filters.
- GraphQL: schema ownership, auth, error strategy, caching.
- gRPC: proto ownership, backward compatibility, streaming usage.
- Async messaging: broker, delivery semantics, retry/DLQ.

## Where to Write Answers
- Overview: `sdd/memory-bank/core/projectbrief.md`
- Requirements: `sdd/memory-bank/core/requirements.md`
- Constraints: `sdd/memory-bank/core/constraints.md`
- Tech stack: `sdd/memory-bank/tech/stack.md`
- Architecture: `sdd/memory-bank/arch/patterns-overview.md`
- Current status: `sdd/memory-bank/core/activeContext.md`
- Intake progress (resume): `sdd/memory-bank/core/intake-state.md`

## Checkpointing / Resume
- After Phase 1, write at least: Project Brief, Tech Stack, Architecture Patterns Overview.
- After Phase 2, update: Requirements and Constraints with the app-type specifics.
- After Phase 3, fill: observability, testing, environments, compliance constraints where applicable.
- After each user response during intake, update `core/intake-state.md` with:
  - current phase
  - phase completion checkboxes
  - missing mandatory fields (if any)
  - last updated date
- If the user re-runs `init` and spec files already contain partial answers, treat it as a resume:
  1. Ask only missing mandatory fields first.
  2. Then offer to continue Phase 2/3.

## Auto-Fill Requirement (Mandatory)
After intake (or when resuming), auto-fill the spec files with the collected answers. At minimum:
- `sdd/memory-bank/core/projectbrief.md` (name, purpose, app type)
- `sdd/memory-bank/tech/stack.md` (language/framework/database + versions)
- `sdd/memory-bank/arch/patterns-overview.md` (architecture style)
Only write sections that have answers.

## Stop for Approval
After writing the spec files, stop and ask for explicit approval.

## After Approval
When the user replies "approved":
1. Create the `app/` directory if it doesn't exist.
2. Generate application code only under `app/`.
3. Say "I will create sprint plan" and populate sprint files.

## Sprint Plan (Post-Approval)
If the user approves, the agent should say "I will create sprint plan" and then populate:
- `sdd/memory-bank/core/sprint-plan.md`
- `sdd/memory-bank/core/sprint-current.md`
