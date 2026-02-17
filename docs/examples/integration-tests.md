# Example: Integration Tests (Patterns)

This is a tool-agnostic reference for how to approach integration tests in projects that use Spectra.

For agent prompt templates, see:
- `sdd/.agent/prompts/tests/write-integration-tests-with-db.md`
- `sdd/.agent/prompts/tests/write-contract-tests-for-public-api.md`

## Suggested Layout Under `app/`

Backend API:
- `app/tests/unit/`
- `app/tests/integration/`
- `app/tests/contract/` (if you expose a public API)

Web:
- `app/tests/unit/`
- `app/tests/e2e/`

## Common Integration Test Types

DB integration tests:
- Run migrations against a clean database.
- Test repository/data access boundaries with real SQL.
- Keep data isolated per test (transaction rollback or per-test schema).

HTTP integration tests:
- Start the app on a random port.
- Make real HTTP calls.
- Assert status codes + response bodies.

Contract tests:
- Freeze request/response contracts for public endpoints.
- Run against both current branch and main (or last release).

Async worker integration tests:
- Test idempotency with duplicate messages.
- Verify retry and DLQ behavior with controlled failures.

## Minimal Quality Gate (Example)
- Unit tests for core validation and business rules.
- Integration tests for DB queries/migrations and any external boundary.
- CI runs tests on every PR (fast unit tests, optional slower integration suite).
