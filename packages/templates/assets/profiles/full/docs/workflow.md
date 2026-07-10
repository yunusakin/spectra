# Workflow

Spectra v2 has one default loop:

Lite: `define -> check -> implement -> check -> resume`

Full: `define -> check -> approve -> implement -> eval -> verify -> release`

The examples use `spectra`. If the repository was bootstrapped with `npx` and no global command was installed, use `./spectra/bin/spectra` instead.

## Define

`spectra init` and `spectra adopt` create the core executable spec bundle. Start by loading planning context:

```bash
spectra context --role planner --goal discover
```

## Validate

```bash
spectra check
spectra status
```

Validation should happen:

- after initialization or adoption
- after meaningful spec changes
- before every approval transition
- before verify

## Approve

Advance the staged approval state explicitly:

```bash
spectra admin approve --stage product-approved
spectra admin approve --stage technical-approved
spectra admin approve --stage implementation-approved
```

Rule:

- no app implementation before `implementation-approved`
- no release signoff before `release-approved`

## Implement

Capture intent first:

```bash
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra context --role implementer --goal implement
```

If the task is docs/spec-only:

```bash
spectra admin quick --type docs --task "refresh docs"
```

## Eval

Run feature behavior checks:

```bash
spectra admin eval my-product-core --suite smoke
```

Use release profile checks when preparing to ship:

```bash
spectra admin eval my-product-core --suite release
```

## Verify

```bash
spectra verify --profile release
```

Verify aggregates:

- structure
- policy
- tests
- eval readiness
- telemetry contract coverage
- release readiness

## Release

Once verify is green:

```bash
spectra admin approve --stage release-approved
```

## Spec Changes After Approval

When specs change after approval:

```bash
spectra admin diff semantic
spectra check
```

Then re-approve the required stage if the diff invalidated it.

## Brownfield Flow

For existing repos:

```bash
spectra adopt .
spectra context --role planner --goal discover
spectra check
spectra admin diff semantic
```

Use the Full profile’s structured outputs under `spectra/sdd/adoption/` to understand gaps before moving into implementation.
