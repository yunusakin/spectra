# Getting Started

This guide explains Spectra end-to-end: installation, intake, validation, approval, scaffolding, sprint execution, and post-code verification.

Work in two places:

- this repo when you are changing the Spectra framework itself
- your target repo after `npx spectra init /path/to/your-project`

## End-to-End Checklist

1. Install Spectra core: `npx spectra init /path/to/your-project`.
2. Optionally add adapters: `npx spectra init /path/to/your-project --agents claude,cursor,windsurf,copilot,codex,antigravity`.
3. For brownfield repos, run `npx spectra adopt /path/to/your-project`.
4. Resolve baseline context with `spectra ctx --role planner --goal discover`.
5. Answer Phase 1 (Core) questions. Say **"recommend"** if unsure about any technical choice.
6. Spectra updates specs and `sdd/memory-bank/core/intake-state.md`.
7. Spectra validates and asks targeted follow-ups if needed.
8. Continue Phase 2 / 2b; optionally skip Phase 3.
9. Before implementation work, capture intent with `spectra task --item <id> --task-type <type> --goal "<goal>"`.
10. Run strict repository validation:

```bash
spectra val
```

11. Approve the product, technical, and implementation stages explicitly:

```bash
spectra ap --stage product-approved
spectra ap --stage technical-approved
spectra ap --stage implementation-approved
```

12. Spectra scaffolds project under `app/`.
13. Spectra executes sprint loop (plan -> skill checks -> code -> test -> verify).
14. Use `spectra st` to monitor overall status.

## Core Files To Know

- Intake flow: `sdd/system/rules/intake/00-intake-flow.md`
- Intake questions: `sdd/system/rules/intake/01-questions.md`
- Intake validation: `sdd/system/rules/intake/02-validation.md`
- Discovery mode: `sdd/system/rules/intake/03-discovery.md`
- Approval gate: `sdd/system/rules/approval/00-approval-gate.md`
- Sprint execution: `sdd/system/rules/workflow/01-sprint-execution.md`
- Post-code verification: `sdd/system/rules/workflow/02-post-code-verification.md`
- Context packs: `spectra ctx --role <role> --goal <goal>` (legacy `--task` aliases are still supported)
- Resume state: `sdd/memory-bank/core/intake-state.md`
- Active context: `sdd/memory-bank/core/activeContext.md`
- Progress tracking: `sdd/memory-bank/core/progress.md`
- Traceability: `sdd/memory-bank/core/traceability.md`
- Discovery notes: `sdd/memory-bank/discovery/`
- Implementation brief: `sdd/memory-bank/core/implementation-brief.md`

## Example Intake Scenarios

- Backend API: [`examples/backend-api-orders-service.md`](examples/backend-api-orders-service.md)
- Web Frontend: [`examples/web-frontend-dashboard.md`](examples/web-frontend-dashboard.md)
- Full-Stack: [`examples/full-stack-booking-platform.md`](examples/full-stack-booking-platform.md)
- Worker: [`examples/worker-billing-reconciler.md`](examples/worker-billing-reconciler.md)
- CLI: [`examples/cli-reporting-tool.md`](examples/cli-reporting-tool.md)

## Common Mistakes

- Treating staged approval like a single binary flag.
- Generating code before `implementation-approved`.
- Skipping validation before approval.
- Changing mandatory choices after approval without re-approval.
- Forgetting to update `progress.md` and `activeContext.md` after significant work.

## Troubleshooting

Validation loops:
- Fix only reported errors, then re-run validation.

Interrupted intake:
- Run `init` again; Spectra resumes from `intake-state.md`.

Spec changes after approval:
- Update specs first, then validate, then re-approve if behavior changed.
