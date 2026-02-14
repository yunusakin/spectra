# Testing Standards

## Mandatory Checks (Agent MUST verify before considering a feature complete)
- [ ] Unit tests cover all core business logic and edge cases
- [ ] Integration tests cover data access layers, external API boundaries, and message consumers
- [ ] Tests are deterministic — no flaky assertions, no reliance on system clock or random data without seeding
- [ ] Coverage target is defined in project docs (default: ≥ 80% line coverage for core modules)
- [ ] Test data uses factories or fixtures — no hard-coded magic values scattered across tests
- [ ] CI runs all tests before merge; failing tests block the PR

## Optional but Recommended
- Contract tests for public APIs or shared interfaces
- E2E tests for critical user-facing flows
- Performance/load tests for latency-sensitive endpoints

## When to Report Errors
If any mandatory check above fails, the agent MUST:
1. Flag missing test coverage and specify which functions/modules need tests.
2. Do not mark the feature as complete until tests pass.

## Reference
- Skill: `sdd/.agent/skills/testing-plan/SKILL.md`
- Prompts: `sdd/.agent/prompts/tests/`
