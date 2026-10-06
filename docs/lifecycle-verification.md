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

## Where it runs

`.github/workflows/validate.yml` runs this check on every validation run and
writes `results.json` to a temporary directory; the report records source and
CLI hashes, generated layout, schema, Git mode, key-file checksums, check-only
inventories and command results. Results are not committed. A failure
that previously exposed a migration defect (v2.0.3 rewriting
`sdd/governance/decision-graph.yaml`) is covered by the checksum comparison of
protected project files before and after migration.
