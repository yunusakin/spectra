# Historical project lifecycle verification

## Failure modes this check covers

- A requested tag or commit is missing, resolves to a different commit, or its
  archived source is incomplete.
- Running the current CLI or current assets during generation would disguise a
  historical regression; each project must be made by the CLI and assets from
  its archived revision.
- A release's CLI version, generated layout, schema marker, or Git mode differs
  from the source revision and is reported incorrectly.
- Project files were generated but not checksummed, so migration could silently
  discard or rewrite meaningful historical content.
- Current `migrate --check` misses required migration or writes during its
  check-only pass.
- Explicit migration fails to converge, changes user-owned historical content,
  leaves legacy layout state behind, or does not produce a project accepted by
  the current validation and normal commands.
- An unsupported historical command, unavailable dependency, or malformed
  fixture is presented as lifecycle coverage rather than an honest limitation.

## Procedure

`node tools/verify-lifecycle-history.mjs [artifact-directory]` archives the
source refs listed below, runs each archived revision's `sync-assets.mjs` and
CLI `init`, records source and project identity/checksums, then runs the current
CLI's `migrate --check`, `migrate --yes` when required, and current project
checks. It writes `results.json` to the artifact directory and removes its
temporary source/project trees afterward. No package installation or network
access is used; the historical CLI resolves `yaml` through a symlink to the
existing workspace dependency (`2.9.1` in the recorded run).

The historical matrix is `v2.0.3`, commit `13287b4` (schema 1), and tags
`v3.0.8`, `v3.0.9`, `v3.1.0`, `v3.1.1`, and `v3.1.2`. The commit is included
by its full SHA in the report. A source is covered only when its archived CLI
successfully generated the project; a failed or unreachable source is recorded
as a limitation, never substituted with current assets.

## Recorded runs

The committed [baseline red artifact](lifecycle-verification-artifacts/results-baseline-red.json)
records the original v2.0.3 migration failure: the migrator rewrote
`sdd/governance/decision-graph.yaml` and recovery reported `Valuable content
changed`. This run is retained as regression evidence, not as the current result.

The canonical [fixed-source results artifact](lifecycle-verification-artifacts/results.json)
records all seven sources passing migration or already-current checks. It captures
the current source identity, archive/CLI/assets hashes, generated layout, schema,
Git mode, project key-file hashes, check-only inventories, command results, and
current validation output. The verification harness and source hashes in the
artifact identify the exact run inputs; the run's current-source commit and dirty
paths are recorded in `current` so the report does not imply a clean checkout.
