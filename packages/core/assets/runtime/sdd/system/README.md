# Spectra System

This directory is the single source of truth for Spectra's runtime rules, manifests, prompts, and generation templates.
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
| `adapters/` | Canonical fragments for generated tool-specific instructions |
| `memory/` | Optional scratch space (not part of the project spec) |

## Key Workflow

1. `init` -> start intake.
2. Capture specs under `sdd/memory-bank/`.
3. Validate -> wait for explicit `approved` -> no code before this.
4. Scaffold the project using a template from `scaffolds/`.
5. Sprint loop: pick items, apply skill checklists, code, test, verify, update progress.
6. Post-code verification before marking any task done.

`sdd/system/` is canonical. Generated adapter files in consumer repositories are derived artifacts, never the source of truth.
