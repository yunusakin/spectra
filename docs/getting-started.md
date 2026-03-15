# Getting Started

This guide explains Spectra end-to-end: installation, intake, validation, staged approval, scaffolding, sprint execution, evals, and release verification.

Work in two places:

- this repo when you are changing the Spectra framework itself
- your target repo after `npx spectra-pack@latest init /path/to/your-project` once the public package is published

## End-to-End Checklist

1. Install Spectra core: `npx spectra-pack@latest init /path/to/your-project`.
2. Optionally add adapters: `npx spectra-pack@latest init /path/to/your-project --agents claude,cursor,windsurf,copilot,codex,antigravity`.
3. For brownfield repos, run `npx spectra-pack@latest adopt /path/to/your-project`.
4. Resolve baseline context with `spectra context --role planner --goal discover`.
5. Answer Phase 1 (Core) questions. Say **"recommend"** if unsure about any technical choice.
6. Spectra updates the feature bundle under `sdd/features/<feature-id>/` and staged approval state under `sdd/governance/approval-state.yaml`.
7. Spectra validates and asks targeted follow-ups if needed.
8. Continue Phase 2 / 2b; optionally skip Phase 3.
9. Before implementation work, capture intent with `spectra task --item <id> --task-type <type> --goal "<goal>"`.
10. Run strict repository validation:

```bash
spectra validate
```

11. Approve the product, technical, and implementation stages explicitly:

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
```

12. Spectra scaffolds project under `app/`.
13. Spectra executes sprint loop (plan -> skill checks -> code -> test -> verify).
14. Use `spectra status` to monitor overall status.

## Core Files To Know

- Feature contract: `sdd/features/<feature-id>/feature.spec.yaml`
- AI behavior contract: `sdd/features/<feature-id>/ai-behavior-spec.yaml`
- Telemetry contract: `sdd/features/<feature-id>/telemetry-contract.yaml`
- Eval contracts: `sdd/features/<feature-id>/evals/`
- Approval state: `sdd/governance/approval-state.yaml`
- Decision graph: `sdd/governance/decision-graph.yaml`
- Context packs: `spectra context --role <role> --goal <goal>` (legacy `--task` aliases are still supported)
- Active context: `sdd/memory-bank/core/activeContext.md`
- Progress tracking: `sdd/memory-bank/core/progress.md`
- Traceability: `sdd/memory-bank/core/traceability.md`
- Discovery notes and adoption outputs: `sdd/memory-bank/discovery/` and `sdd/adoption/`
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
- Editing Markdown narrative without syncing the YAML contracts it describes.

## Troubleshooting

Validation loops:
- Fix only reported errors, then re-run validation.

Interrupted intake:
- Run `init` again; Spectra resumes from the installed repo state and current approval/governance files.

Spec changes after approval:
- Update specs first, then validate, then re-approve if behavior changed.
