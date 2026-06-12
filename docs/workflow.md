# Workflow

Spectra v2 has one default loop:

`define -> validate -> approve -> implement -> eval -> verify -> release`

## Define

`spectra init` and `spectra adopt` create the core executable spec bundle. Start by loading planning context:

```bash
spectra context --role planner --goal discover
```

## Validate

```bash
spectra validate
spectra status
```

Validation should happen:

- after feature creation
- after initialization or adoption
- after meaningful spec changes
- before every approval transition
- before verify

## Approve

Advance the staged approval state explicitly:

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
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
spectra quick --type docs --task "refresh docs"
```

## Eval

Run feature behavior checks:

```bash
spectra eval my-product-core --suite smoke
```

Use release profile checks when preparing to ship:

```bash
spectra eval my-product-core --suite release
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
spectra approve --stage release-approved
```

## Spec Changes After Approval

When specs change after approval:

```bash
spectra diff semantic
spectra validate
```

Then re-approve the required stage if the diff invalidated it.

## Brownfield Flow

For existing repos:

```bash
spectra adopt .
spectra context --role planner --goal discover
spectra validate
spectra diff semantic
```

Use the structured outputs under `sdd/adoption/` to understand gaps before moving into implementation.
