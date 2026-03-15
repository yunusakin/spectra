# Spectra Structure

This document is the shortest accurate map of the current Spectra v2 repository.

## Top-Level Layers

### `packages/cli/`

The public CLI package.

- exposes the `spectra` binary
- owns command parsing and user-facing output
- packages runtime and template assets for `npm pack` and future npm publish

### `packages/core/`

The internal runtime source package.

- stores the packaged shell runtime assets
- keeps the internal scripts and `sdd/system/` runtime files
- is not intended to be the user-facing install surface

### `packages/templates/`

The internal template package.

- stores the base project files that `spectra init` and `spectra adopt` install
- includes starter docs, memory-bank files, and app placeholders

### `scripts/`

Internal runtime helpers for Spectra development.

- still used internally by the packaged runtime
- not part of the consumer-facing workflow
- users should run `spectra ...`, not `bash scripts/...`

### `sdd/`

The canonical spec and governance workspace for this repository.

It now contains both legacy memory-bank documents and v2 structured contracts.

## `sdd/` Layout

### `sdd/features/<feature-id>/`

Feature-level executable spec bundle.

- `feature.spec.yaml`: product scope, requirements, acceptance
- `ai-behavior-spec.yaml`: AI behavior contract
- `telemetry-contract.yaml`: production observability contract
- `technical-decisions.yaml`: technical boundaries and invariants for the feature
- `release-thresholds.yaml`: release gate thresholds
- `evals/`: golden scenarios, failure modes, regression suite, reports
- `brief.md`: short human-readable narrative for the feature

### `sdd/governance/`

Repository-level governance state.

- `approval-state.yaml`: staged approval state machine status
- `decision-graph.yaml`: decision dependency and impact model

### `sdd/adoption/`

Brownfield adoption outputs.

- `current-state.summary.yaml`: current codebase understanding
- `gap-analysis.yaml`: matches, partial, missing, conflict, unknown
- `review-queue.yaml`: manual-review backlog

### `sdd/memory-bank/`

Legacy and operational context files.

- still useful for long-form human collaboration
- not the preferred source for machine-readable v2 state
- should be loaded selectively through `spectra context`

### `sdd/system/`

Canonical workflow rules, prompts, adapters, scaffolds, and runtime instructions.

## Consumer Repo Shape

After `spectra init`, a consumer repository should look like this:

```text
your-project/
├── .spectra/
│   └── install.json
├── app/
├── docs/
└── sdd/
    ├── features/
    ├── governance/
    ├── memory-bank/
    └── system/
```

Important:

- consumers use `spectra` only
- packaged runtime stays behind the CLI
- `scripts/` should not be part of the consumer repo interface

## Source Of Truth Rules

- YAML under `sdd/features/` and `sdd/governance/` is the canonical structured state
- Markdown under `brief.md` and `sdd/memory-bank/` is human-readable support context
- generated reports and summaries are derived, not canonical

## Recommended Reading Order

If you are trying to understand the repo quickly:

1. `README.md`
2. `docs/overview.md`
3. `docs/structure.md`
4. `docs/quick-start.md`
5. `docs/workflow.md`
