# Workflow

Spectra follows one workflow: `define -> check -> approve -> implement -> eval -> verify -> release`.

The examples use `spectra`. If the repository was bootstrapped with `npx` and no global command was installed, use `./.spectra/bin/spectra` instead.

## Define

`spectra init` and `spectra adopt` create the core executable spec bundle. If `projectbrief.md` is still a template, run onboarding first; then load planning context:

```bash
spectra onboard
spectra context --role planner --goal discover
```

For existing projects, `adopt` writes an initial repo index when possible. Re-run `spectra index` after manifest changes or if adoption reports that indexing failed.

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

Use release checks when preparing to ship:

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
- repo-index freshness
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
spectra check
```

Then re-approve the required stage if the diff invalidated it.

## Brownfield Flow

For existing repos:

```bash
spectra adopt .
spectra onboard
spectra context --role planner --goal discover
spectra check
spectra diff semantic
```

Use the structured outputs under `.spectra/sdd/adoption/` to understand gaps before moving into implementation.
