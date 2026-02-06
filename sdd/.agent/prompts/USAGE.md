# Prompts Usage Guide

Prompts are reusable templates and checklists to keep work consistent across agents and sessions.

## How To Use a Prompt
1. Pick a prompt from `sdd/.agent/prompts/index.md`.
2. Paste the prompt content into your agent conversation, or instruct the agent to "use" that prompt file.
3. Provide any required inputs mentioned in the prompt.

## Safety Rules
- Prompts that instruct writing code under `app/` must only be used **after** the user replies `approved`.
- Prompts can be used for spec/doc/review work at any time.

## Common Scenarios
- Start development after approval: `development/start-new-development.md`
- Review an API endpoint: `maintenance/api-endpoint-review-checklist.md`
- Prepare release notes: `docs/prepare-release-notes.md`
- Write unit tests: `tests/write-unit-tests-for-module.md`
- Create architecture diagram (Mermaid): `docs/create-architecture-diagram.md`

