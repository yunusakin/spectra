# Getting Started

This guide explains Spectra end-to-end: intake, validation, approval, scaffolding, sprint execution, and post-code verification.

## End-to-End Checklist

1. Install Spectra: `./scripts/init.sh /path/to/your-project` (or via curl — see `docs/quick-start.md`).
2. Answer Phase 1 (Core) questions. Say **"recommend"** if unsure about any technical choice.
3. Agent updates specs and `sdd/memory-bank/core/intake-state.md`.
4. Agent validates and asks targeted follow-ups if needed.
5. Continue Phase 2 / 2b; optionally skip Phase 3.
6. Run strict repository validation:

```bash
bash scripts/validate-repo.sh --strict
```

7. Reply `approved`.
8. Agent scaffolds project under `app/`.
9. Agent executes sprint loop (plan -> skill checks -> code -> test -> verify).
10. Use `bash scripts/health-check.sh` to monitor overall status.

## Core Files To Know

- Intake flow: `sdd/.agent/rules/intake/00-intake-flow.md`
- Intake questions: `sdd/.agent/rules/intake/01-questions.md`
- Intake validation: `sdd/.agent/rules/intake/02-validation.md`
- Discovery mode: `sdd/.agent/rules/intake/03-discovery.md`
- Approval gate: `sdd/.agent/rules/approval/00-approval-gate.md`
- Sprint execution: `sdd/.agent/rules/workflow/01-sprint-execution.md`
- Post-code verification: `sdd/.agent/rules/workflow/02-post-code-verification.md`
- Resume state: `sdd/memory-bank/core/intake-state.md`
- Active context: `sdd/memory-bank/core/activeContext.md`
- Progress tracking: `sdd/memory-bank/core/progress.md`
- Traceability: `sdd/memory-bank/core/traceability.md`

## Example Intake Scenarios

- Backend API: [`examples/backend-api-orders-service.md`](examples/backend-api-orders-service.md)
- Web Frontend: [`examples/web-frontend-dashboard.md`](examples/web-frontend-dashboard.md)
- Full-Stack: [`examples/full-stack-booking-platform.md`](examples/full-stack-booking-platform.md)
- Worker: [`examples/worker-billing-reconciler.md`](examples/worker-billing-reconciler.md)
- CLI: [`examples/cli-reporting-tool.md`](examples/cli-reporting-tool.md)

## Common Mistakes

- Generating code before `approved`.
- Skipping validation before approval.
- Changing mandatory choices after approval without re-approval.
- Forgetting to update `progress.md` and `activeContext.md` after significant work.

## Troubleshooting

Validation loops:
- Fix only reported errors, then re-run validation.

Interrupted intake:
- Run `init` again; agent resumes from `intake-state.md`.

Spec changes after approval:
- Update specs first, then validate, then re-approve if behavior changed.
