# Codex Agent Entry

All canonical rules live in `sdd/.agent/`.

Read and follow:
- `sdd/.agent/README.md`
- `sdd/.agent/rules/index.md`

## Init Trigger
If the user message is exactly `init`, start the intake flow and do not write any application code.

## Hard Rules
- Do not generate application code before explicit approval.
- All application code must be generated under `app/` only.
- Specs and decisions live under `sdd/memory-bank/`.
- If a free-text answer is blank, do not write any section for it.
- Free-text answers may use Markdown; keep it concise and prefer bullets.
- After intake, auto-fill the spec files with the collected answers (see intake flow).

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
