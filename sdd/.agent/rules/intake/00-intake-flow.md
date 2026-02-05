# Intake Flow

## Trigger
- Start intake when the user message is exactly `init`.

## Hard Rules
- Do not generate application code before explicit approval.
- All application code must be generated under `app/` only.
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

## Question Rules
- Every multiple-choice question must include an `Other` option.
- If a free-text answer is blank, omit that section from docs.
- Free-text answers may use Markdown; keep it concise and prefer bullets.

## Conditional Mobile Follow-ups
If App Type = Mobile, ask:
- Platform(s)
- Mobile framework
- Minimum OS versions
- App store distribution
- Offline support
- Push notifications
- Device capabilities needed

## Where to Write Answers
- Overview: `sdd/memory-bank/core/projectbrief.md`
- Requirements: `sdd/memory-bank/core/requirements.md`
- Constraints: `sdd/memory-bank/core/constraints.md`
- Tech stack: `sdd/memory-bank/tech/stack.md`
- Architecture: `sdd/memory-bank/arch/patterns-overview.md`
- Current status: `sdd/memory-bank/core/activeContext.md`

## Auto-Fill Requirement (Mandatory)
After intake, auto-fill the spec files with the collected answers. At minimum:
- `sdd/memory-bank/core/projectbrief.md` (name, purpose, app type)
- `sdd/memory-bank/tech/stack.md` (language/framework/database + versions)
- `sdd/memory-bank/arch/patterns-overview.md` (architecture style)
Only write sections that have answers.

## Stop for Approval
After writing the spec files, stop and ask for explicit approval.
