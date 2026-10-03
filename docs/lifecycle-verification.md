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

## Final lifecycle milestone

The audited baseline was application 3.1.2, project schema 3 and feature API
`spectra/v2`; the baseline suite passed 230/230. The canonical command set grew
from 22 to 23 entries when `uninstall` was added. Application version, project
schema and feature API remain independent identifiers. The audited update flow
still coupled software refresh to implicit project migration and bootstrap; the
milestone separates those paths behind a compatibility evaluator and explicit
`migrate` command.

Historical CLI entrypoints generated each archived project from v2.0.3, the
schema-1 commit, v3.0.8, v3.0.9, v3.1.0, v3.1.1 and v3.1.2. The final matrix
passed 7/7: the first five required explicit migration and converged to canonical
schema 3; v3.1.1 and v3.1.2 were already current. Check-only inventories and
protected project files remained unchanged. See the current `results.json` for
full source SHAs, hashes, commands and outcomes.

Final verification on 2026-10-03 used Node 22.22.0 on darwin-arm64:

- `npm ci`: passed; 8 packages installed, zero reported vulnerabilities.
- `npm test`: 347/347 passed; repeatable lifecycle, migration and native
  transport evidence was retained by the E2E harnesses.
- `npm run check`, version parity at 3.1.2, syntax checks and `git diff --check`:
  passed.
- Native archive build and `smoke-native.sh`: passed using the packaged
  executable and adjacent assets.
- Packaged release verifier: passed 45 commands for npm and native 3.1.2; both
  distribution paths adopted projects and preserved their inventories across
  machine uninstall, fallback and reinstall. Artifact:
  `/private/tmp/spectra-release-final/run-ba2ULr/results.json`.
- Focused native uninstall suite: 12/12 passed, including interrupted active
  deletion, retained-version manual recovery, replacement races, path traversal,
  and preservation of project and unrelated machine data. Artifact:
  `/private/tmp/spectra-uninstall-final-current/spectra-native-e2e-gy3QmB/results.json`.

Only darwin-arm64 native execution was performed locally. CI now builds and
verifies darwin-arm64, darwin-x64, linux-arm64 and linux-x64; the three other
targets are not claimed as locally tested. Windows continues to use the Node
project fallback. A legacy native installation without a machine ownership
record is preserved; its owner must run `spectra update --yes` to establish
managed ownership before `spectra uninstall --yes` can remove it.

The implementation keeps project state under `.spectra`, makes `update`
project-independent, migrates schema 1/2 and recognized unversioned layouts
through an explicit snapshot-backed, retryable process, and removes only
record-verified native version trees. Unexpected files, links, shared parent
directories and partial-removal recovery paths are preserved. Project launcher
resolution prefers a verified stable machine command, then its materialized
project-local Node CLI, then PATH; it retains a standalone pin where appropriate
and avoids recursion/self-deletion.

The implementation does not add ADE or agent execution, external project
storage, schema reversal, a package registry, or new context behavior. Native
platforms other than the local darwin-arm64 target remain CI coverage only.
