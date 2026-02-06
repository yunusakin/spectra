## Quick Start

1. Clone this repository.
2. Open your preferred AI agent in the repo root.
3. Optional: see `docs/examples/` for sample intake answers.
4. Type `init` to start the intake flow.
5. Answer the Phase 1 (Core) mandatory intake questions about project name, purpose, tech stack, and architecture.
6. If prompted, continue with Phase 2 (type-specific) follow-ups that match your app type, and optionally skip Phase 3 (advanced) questions.
7. Review the generated spec files under `sdd/memory-bank/`.
   - If you stop mid-intake, re-run `init` later. The agent should resume using `sdd/memory-bank/core/intake-state.md`.
8. Reply `approved` when you are happy with the specs so the agent can start coding in `app/` (see `app/README.md` for a suggested layout).

<!--
Example intake answers (very short):

- Project name: Customer Orders Service
- Purpose: Manage customer orders, payments, and shipment status.
- App type: Backend API
- Language + framework: Java 21, Spring Boot 3.2
- Database: PostgreSQL 16
- Architecture: Hexagonal
-->
