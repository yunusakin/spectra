# Validate, Eval, and Verify

Spectra uses three different quality layers. Keep them separate.

## `spectra check`

Purpose:

- check structure
- check policy
- check approval-state consistency
- check executable spec completeness

Run it:

```bash
spectra check
spectra check --base <base_sha> --head <head_sha>
```

Use it:

- after creating or changing specs
- before approvals
- before verify

CI note:

- the GitHub `validate` workflow prepares a Node 22 runtime and runs `npm ci` before invoking CLI-based validation smoke checks
- this is required because the validation path executes `node packages/cli/bin/spectra.js ...` and depends on packaged CLI dependencies being installed

## `spectra eval` (Full)

Purpose:

- check feature behavior contracts, or run real application commands when a suite uses `tool_mode: command`
- run release-threshold logic
- catch regression against the feature’s eval definitions

Run it:

```bash
spectra eval my-product-core --suite smoke
spectra eval my-product-core --suite release
```

Use it:

- after implementation work
- before release verification

Generated suites use `tool_mode: contract` and check contract structure only. For application behavior, set `execution.tool_mode: command` in the feature's `evals/regression-suite.yaml`, add optional `execution.setup` shell commands, and give each selected scenario an `input.command` and `expected.exit_code`. Commands run from the project root. A scenario can also supply `input.fixture.files` and use `<case-fixture>` in its command; Spectra creates and removes a temporary fixture directory. `expected.stdout` and `expected.stderr` compare exact output, while `stdout_contains` and `stderr_contains` check fragments.

## `spectra verify`

Purpose:

- produce release confidence, not just pass/fail test status
- aggregate validation, policy, legacy verify inputs, eval readiness, telemetry coverage, repo-index freshness, and release readiness

Run it:

```bash
spectra verify --profile standard
spectra verify --profile release
```

Use it:

- before handoff
- before release approval

## Recommended Sequence

```bash
spectra check
spectra eval <feature-id> --suite smoke
spectra verify --profile release
```

## What Should Block Work

Blocking:

- validation errors
- policy failures
- missing staged approvals
- verify blocked verdict
- failing release eval thresholds

Warning-only:

- optional docs gaps
- non-blocking context-pack budget warnings
- missing or stale repo index; run `spectra index` to refresh it
- incomplete narrative Markdown when YAML contracts are valid

## Contributor Note

The runtime still uses internal deterministic scripts under the packaged runtime, but users should reason about quality through:

- `spectra check`
- `spectra eval`
- `spectra verify`

For GitHub Actions, mirror the repository workflow pattern:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm

- run: npm ci
```
