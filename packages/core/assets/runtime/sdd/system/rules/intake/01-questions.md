# Intake Questions (Progressive Router)

Use this file as a router only. Do not load every question pack at once.

## Question Contract Requirement
For technical questions, follow `04-question-contract.md` and use IDs from `05-question-catalog.md`.

- Do not persist technical choices before explicit confirmation.
- Record confirmed technical choices in `sdd/memory-bank/core/intake-state.md` -> `## Decision Log`.
- Record unresolved technical choices in `sdd/memory-bank/core/intake-state.md` -> `## Open Technical Questions`.

## Loading Policy
- Ask in small batches (<= 10 questions per turn).
- Load only the pack for the current phase and scope.
- For Full-stack in Phase 2, load both backend and web packs.
- Do not preload optional packs until needed.

## Phase Packs

### Phase 1 (Core, required)
- `questions/01-phase-1-core.md`

### Phase 2 (Type-specific, recommended)
- Backend API: `questions/02-phase-2-backend.md`
- Web (frontend only): `questions/03-phase-2-web.md`
- Full-stack: `questions/02-phase-2-backend.md` + `questions/03-phase-2-web.md`
- Mobile: `questions/04-phase-2-mobile.md`
- CLI: `questions/05-phase-2-cli.md`
- Worker/Batch: `questions/06-phase-2-worker.md`
- Library/SDK: `questions/07-phase-2-library.md`

### Phase 2b (API-style, recommended)
- `questions/08-phase-2b-api-style.md`

### Phase 3 (Advanced, optional)
- `questions/09-phase-3-advanced.md`
