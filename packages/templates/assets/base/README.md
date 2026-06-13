# Spectra-Managed Project

This repository is managed with Spectra.

Spectra is a CLI-first operating system for AI-assisted product development. It keeps product intent, executable specs, staged approvals, AI behavior contracts, evals, telemetry expectations, and release readiness in the repository.

## Quick Start

```bash
spectra validate
spectra status
spectra context --role planner --goal discover
```

If the global `spectra` command is unavailable, use the repo-local launcher:

```bash
./.spectra/bin/spectra validate
./.spectra/bin/spectra status
```

## Core Workflow

```bash
spectra context --role planner --goal discover
spectra validate
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra approve --stage implementation-approved
spectra context --role implementer --goal implement
spectra eval <feature-id> --suite smoke
spectra verify --profile release
spectra approve --stage release-approved
```

## Repository Structure

```text
.
├── .spectra/
│   ├── bin/spectra
│   └── install.json
├── app/
├── docs/
└── sdd/
    ├── features/
    ├── governance/
    ├── memory-bank/
    └── system/
```

## Canonical State

Feature contracts live under `sdd/features/<feature-id>/`:

- `feature.spec.yaml`
- `ai-behavior-spec.yaml`
- `telemetry-contract.yaml`
- `technical-decisions.yaml`
- `release-thresholds.yaml`
- `evals/*`
- `brief.md`
- `release-checklist.md`

Governance state lives under `sdd/governance/`:

- `approval-state.yaml`
- `decision-graph.yaml`

YAML files are canonical machine-readable state. Markdown files provide human context.

## Documentation

- [Quick Start](docs/quick-start.md)
- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/cli-reference.md)
- [Repository Structure](docs/structure.md)
- [Workflow](docs/workflow.md)
- [Testing and Verification](docs/testing.md)
- [Examples](docs/examples/README.md)

## Rules of Use

- Run `spectra validate` before approval changes.
- Do not start app implementation before `implementation-approved`.
- Run `spectra eval` and `spectra verify --profile release` before release approval.
- Keep canonical contract data in YAML, not duplicated in Markdown.
- Use role-aware context packs instead of loading the whole repo into agents.
