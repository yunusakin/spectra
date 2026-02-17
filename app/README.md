# app/

This directory is reserved for application code.

Spectra is spec-first: before approval, do not generate any application code. After the user replies `approved`, generate all application code under `app/` only.

If `app/` does not exist, create it after approval before writing any code.

## Suggested Layout (Pick What Fits)

Backend API:
- `src/` application source
- `tests/` unit/integration tests
- `migrations/` database migrations (if applicable)
- `infra/` deployment manifests, IaC, local dev compose

Web (frontend):
- `src/` frontend source
- `public/` static assets
- `tests/` unit/e2e tests

Full-stack:
- `backend/` backend API
- `web/` frontend app
- `shared/` shared types/contracts (optional)

## Keep Specs Out Of `app/`
- Specs and decisions live under `sdd/memory-bank/`.
- Agent rules live under `sdd/.agent/`.
