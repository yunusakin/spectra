# Canonical Agent Rules

This directory is the single source of truth for all agent rules.
Use `rules/index.md` to locate the correct rule file for a task.

## Directories

| Directory | Contents |
|-----------|----------|
| `rules/` | Intake flow, workflow rules, approval gate, domain standards |
| `runtime/` | Minimal context loading manifests for token-efficient operation |
| `skills/` | Post-approval checklists — API design, DB migration, security, testing, ops, release |
| `scaffolds/` | Project skeleton templates per app type (backend-api, web-frontend, full-stack, cli, worker) |
| `plans/` | Plan templates — feature, integration, migration, release, UI |
| `prompts/` | Reusable agent prompts and checklists |
| `memory/` | Agent-specific scratch space (not part of the project spec) |

## Key Workflow

1. `init` -> start intake.
2. Capture specs under `sdd/memory-bank/`.
3. Validate -> wait for explicit `approved` -> no code before this.
4. Scaffold the project using a template from `scaffolds/`.
5. Sprint loop: pick items, apply skill checklists, code, test, verify, update progress.
6. Post-code verification before marking any task done.

Skills are used after approval. Prompts are optional reusable templates.
