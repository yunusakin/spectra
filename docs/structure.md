# Structure

This is the shortest accurate map of Spectra v2.

## Consumer Repo Shape

After `spectra init`, a repo should look like this:

```text
your-project/
├── .spectra/
├── app/
├── docs/
└── sdd/
    ├── features/
    │   └── <feature-id>/
    ├── governance/
    └── system/
```

## What Lives Where

### `sdd/features/<feature-id>/`

Feature bundle and executable contracts:

- `feature.spec.yaml`
- `ai-behavior-spec.yaml`
- `telemetry-contract.yaml`
- `technical-decisions.yaml`
- `release-thresholds.yaml`
- `evals/golden-scenarios.yaml`
- `evals/regression-suite.yaml`
- `evals/failure-modes.yaml`
- `evals/release-thresholds.yaml`
- `brief.md`
- `release-checklist.md`

### `sdd/governance/`

Repo-level governance state:

- `approval-state.yaml`
- `decision-graph.yaml`

### `sdd/system/`

Runtime rules, prompts, adapters, scaffolds, and policy assets used by the CLI/runtime.

### Optional `sdd/memory-bank/`

Long-form human context may still exist for migration, brownfield adoption, or supporting notes:

- active context
- progress
- implementation brief
- review notes
- traceability

Use these selectively. They are supporting context, not the primary v2 machine-readable source.

## Command-to-Structure Mapping

- `spectra init` and `spectra adopt` create the core feature bundle under `sdd/features/`
- `spectra approve` updates `sdd/governance/approval-state.yaml`
- `spectra diff semantic` inspects changed spec/governance state
- `spectra context` reads compact summaries and selected source files
- `spectra eval` reads feature eval contracts
- `spectra verify` aggregates contracts, policy, and release evidence

## Contributor Note

If you are changing Spectra itself rather than using it in a product repo, the internal implementation lives under the workspace packages and runtime assets. That is contributor context, not user onboarding. Users should interact with `spectra`, not with internal runtime scripts.
