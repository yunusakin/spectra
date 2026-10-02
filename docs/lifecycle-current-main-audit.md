# Lifecycle audit — current main, 2026-10-02

This records existing behavior before product changes. OBSERVED means source,
history or a local command establishes the finding. INFERENCE means a consequence
not yet exercised by a dedicated lifecycle experiment. IMPLEMENTATION DECISION
identifies proposed behavior, which is not current behavior.

## Baseline

- OBSERVED: fetched `origin/main` is
  `e3aca7154a5cc255fa1469d50c124ceab1d48b29` (merge of release PR #31).
- OBSERVED: checkout is clean on `release/3.1.2`, HEAD
  `e68325725901b59d02e125aaf81c9dd50719fd83`; `git diff HEAD origin/main`
  has no file differences. Audit reads therefore match current main.
- OBSERVED: root, CLI (`spectra-pack`), core (`@spectra/core`) and templates
  (`@spectra/templates`) package versions are all 3.1.2. CLI constant is 3.1.2.
- OBSERVED: `SCHEMA_VERSION` is 3 in `lib/install-metadata.js`. Feature,
  adoption, evaluation and governance contracts use `spectra/v2`.
- OBSERVED: 21 documented canonical public commands, including help/version;
  validate is a compatibility alias. `__update-project` is internal.
- OBSERVED: version parity and `npm run check` passed during this audit.
- OBSERVED: after correcting historical path wording, the final unchanged-product
  baseline at `e3aca7154a5cc255fa1469d50c124ceab1d48b29` passed 230/230 tests,
  with zero failed, skipped or cancelled. Log: `/tmp/spectra-task1-baseline-tests.log`.
  The focused docs vocabulary check passed 1/1 (log:
  `/tmp/spectra-task1-baseline-docs.log`). Strict `npm run check` reported
  `Validation: OK` (`/tmp/spectra-task1-baseline-check.log`); version parity
  reported `Version parity OK: 3.1.2` (`/tmp/spectra-task1-baseline-parity.log`).
  These are baseline results before the deliberately RED lifecycle contract tests.

## Distribution and installation

OBSERVED: native build uses esbuild and Node SEA, with postject for older SEA
build APIs. Release CI builds darwin-arm64, darwin-x64, linux-arm64 and linux-x64
using Node 22. Windows has no native release. Archives contain `bin/spectra`,
assets/runtime, assets/profiles, VERSION and LICENSE and have SHA-256 sidecars.

OBSERVED: install.sh downloads archive/checksum, verifies before extraction,
then installs at `$SPECTRA_HOME/<VERSION>` (default
`~/.local/share/spectra/<version>`). It exposes `$SPECTRA_BIN/spectra` (default
`~/.local/bin/spectra`) using a symlink, falling back to a copied executable.
It prints PATH instructions; it does not edit a shell profile or install shell
completion. It deletes an existing same-version directory without ownership
verification. Archive VERSION is interpolated into a deletion path without
strict version validation. No machine ownership manifest exists.

OBSERVED: update leaves other version directories in place. The installer itself
does not create project state. npm package exposes `bin/spectra.js` and ships
src/assets/docs/license with yaml as its runtime dependency. Prepack runs
version parity and asset synchronization. npx bootstrap does not install a
global command. Project bootstrap copies a self-contained CLI plus yaml under
`.spectra/cli`; native bootstrap cannot materialize this source fallback.

## Project layout and fallback

OBSERVED: detection probes manifest files in order: `.spectra/sdd/system`,
`./spectra/sdd/system` (historical only), then root `sdd/system`. The supported layout names are
canonical, spectra-dir and root-sdd. Root-sdd cache/metadata live in `.spectra`
while the runtime/spec/memory tree lives at root. Project lookup walks upward.
Manifest absence can prevent discovery of a broken metadata-only project.

OBSERVED: POSIX launcher resolves recorded native binary, local Node CLI,
PATH spectra, then exit 127. The recorded binary is normally realpath of the
versioned executable. Launcher contains only resolution logic. The Windows
batch launcher invokes only the local Node CLI. Environment
`SPECTRA_BINARY_PATH` can supply a native path during bootstrap.

INFERENCE: a launcher recorded against an old retained version keeps choosing
that version after the global link changes. Deleting all machine versions
breaks native-only launchers unless a replacement machine command is available.
Node fallback projects can remain operational after machine removal.

OBSERVED: materialization compares real source/destination identities and skips
self-replacement. Commit e683257 added this after packaged E2E exposed repair
deleting the executing fallback. cd89087 packaged local runtime assets;
a2d3771 preserved native detection; 371f4b4 changed active-native update behavior.

## Update, migration and repair overlap

OBSERVED: update first requires findSpectraRoot, then discovers latest version
using npm view or GitHub curl (SPECTRA_LATEST_VERSION is a test override).
It compares application/runtime versions, schema and layout. Confirmation
precedes either self-update or layout migration plus installSpectra refresh.
Completion follows validateCommand, including project policy checks.

OBSERVED: Node self-update invokes npx at the requested version with internal
`__update-project`; it does not replace a globally installed npm package.
Native self-update downloads install.sh and sets SPECTRA_BIN to the directory
of execPath, then invokes that execPath for internal project update. This
does not reliably identify the stable global command location when execPath
is the versioned binary. resolveInstalledNativeCommand exists but is unused
in this flow.

OBSERVED: installSpectra unconditionally calls migrateLegacyLayout before
bootstrap/refresh. Thus init, adopt and doctor --fix are implicit layout
migration entrypoints. Metadata/config are stamped with current schema;
schemaOutdated causes update to refresh directly to current without adjacent
schema steps. No authoritative compatibility evaluator or public migrate /
uninstall exists. No explicit higher-schema guard prevents metadata downgrade.

OBSERVED: existing layout migration protects source repositories even with stray
canonical state, preflights destination collisions, preserves company docs,
merges regenerable cache with target winning, normalizes only recorded Git
exclusions, and moves the detecting sdd manifest late. It refuses canonical
state missing metadata and parallel legacy authoritative trees. It cleans
cache-only legacy leftovers. Malformed migration metadata is currently treated
as an empty object. Metadata may advance before all moves finish, so schema
completion cannot currently be trusted independently of layout completion.

OBSERVED: root-sdd metadata-less historical installations exist (v2.0.3 has no
schema/application fields). Schema 1 was introduced in profile.js at 13287b4.
Schema 2 appears in v3.0.8, v3.0.9 and v3.1.0 profile.js; schema 3 in v3.1.1
install-metadata.js reflects profile removal/unified capability installation
(e27131e). c3d3b4c added schema 2 with business-context rollout.

## Metadata field audit

| Field | Existing meaning | IMPLEMENTATION DECISION |
| --- | --- | --- |
| cliVersion | Latest bootstrap/refresh CLI | KEEP; explain as last project updater |
| runtimeVersion | Materialized replaceable asset release | KEEP; never infer schema from it |
| schemaVersion | Project install/config contract | KEEP, integer, validated |
| binaryPath | Native execution fallback | KEEP for compatibility; no deletion authority |
| localLauncher | Portable command relative path | KEEP |
| docsProjectName | Stable sanitized documentation namespace | KEEP |
| docsGuidePaths | Owned guides refresh can replace | KEEP and validate relative paths |
| ownedPaths | Owned generated files for Git policy | KEEP; never use as machine deletion paths |
| excludePatterns | Managed Git exclusions | KEEP |
| gitMode | local or shared | KEEP unchanged during migration |
| installMode | init/adopt provenance | KEEP |
| installedAt | Bootstrap/refresh time, reset by install | KEEP historical value; add update timestamp |
| profile | Historical Lite/Full selector | DEPRECATE through explicit 2→3 migration |
| createdWith | Not present | Add optionally, preserve thereafter; unknown stays unknown |

OBSERVED: install currently reconstructs metadata and can discard unrecognized
fields; doctor merges metadata but refresh already reconstructs it. There is
no reliable original-creation application version after a prior refresh.
INFERENCE: current cliVersion cannot truthfully establish original creation.

## Command effects and Git policy

OBSERVED: help/version are project independent. context writes caches; task,
knowledge, onboard interactive, index default, adapters, approve, eval, verify
and diff modes can mutate state. check/validate run shell validation and policy.
doctor --fix refreshes generated state. Source inspection shows status calls
computeApprovalState, which writes approval-state.yaml and intake-state.md;
the reference's unconditional read-only description is inaccurate even when
the generated bytes happen to match. Semantic diff also calls that writer.

OBSERVED: local is the default for init/adopt; local requires an existing Git
worktree and refuses tracked Spectra-owned roots/adapters. Git's actual
info/exclude location is resolved for worktrees and nested targets. Shared
permits non-Git bootstrap and does not add local exclusions. Git mode changes
are refused; the message mentions an unspecified explicit migration command.

## Existing verification

OBSERVED: root scripts are npm test, npm run check and npm run verify. CI uses
npm ci, strict repo validation, policy, adapter/skill smokes, parity, npm test
on Node 20/22. Test discovery is explicit across CLI src/test, excluding fixtures.
tools/verify-release.mjs installs a packed npm artifact and a native archive
via the real installer with local curl transport, rejects bad checksum, checks
Node-free native operation, adoption, sibling init, local launcher, memory/docs
preservation, repeat repair (including symlink project alias), current-version
update and repeat adoption. It retains results.json and SHA-256 inventories.
Release CI separately executes smoke-native.sh; packaged verifier is not wired
as a release CI gate. Prior 3.1.2 report says 230 tests passed; that is historical
evidence, not the result of the current audit run.

OBSERVED: migration.test.js covers synthetic root-sdd and spectra-dir fixtures,
local/shared exclusions, source-repository protection, conflicts, retry and
cache cleanup. update.test.js covers implicit layout/schema refresh, prompts,
validation failure and Node self-update dispatch. unified-install-e2e explicitly
expects schema 2→3 via update. Those expectations must move to migrate.
No uninstall, multi-project machine lifecycle or real historical-generation
matrix currently proves the requested product contract.

## Required separation

IMPLEMENTATION DECISION: preserve canonical project state, existing layout
safety, fallback materialization and Git policy. Reuse existing installer,
validation, option parser, output style and retained E2E artifact format.
Introduce one compatibility evaluator, explicit migration steps and proven
machine ownership. No external project store, registry, ADE or context redesign.
