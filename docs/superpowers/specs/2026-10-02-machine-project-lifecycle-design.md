# Spectra machine application and project lifecycle

Status: proposed design for review; product implementation has not begun.
Evidence: [current-main audit](../../lifecycle-current-main-audit.md).

## Intent and constraints

Install one application per machine, operate on independent repository-local
`.spectra` projects, update software without project mutation, migrate one
project intentionally, and remove only owned machine artifacts. Preserve
restricted-environment launchers, self-contained Node fallback, source-repo
protection, local default/shared alternative Git policy and user knowledge.
The user's supplied milestone is the acceptance contract, including historical
dogfood, packaged npm/native verification and retained repeatable artifacts.

## Approach

Extend the existing filesystem architecture. Keep layout operations in
migration.js, reuse installSpectra for replaceable bootstrap material, and
introduce small compatibility and machine-installation modules. Avoid moving
unrelated files or creating a transaction framework.

Alternatives considered: keeping update as a wrapper around project refresh
violates independent lifecycles; introducing a global project store or registry
violates the product contract. Neither is selected.

## Three version domains

Application version remains synchronized across packages, lockfile, CLI,
manifests and native VERSION. This work does not by itself choose a published
release version. Current application baseline is 3.1.2.

Project storage schema remains 3: the milestone formalizes existing schemas
rather than creating a breaking persistent format solely to match examples.
Optional provenance fields do not require a schema bump. Adjacent migration
steps are legacy/unversioned normalization, 1→2 business-context scaffolding
and 2→3 unified capability/profile removal. Feature/spec API remains spectra/v2.
Future incompatible persistent changes require their own adjacent step and
schema bump; releases that leave storage unchanged do not.

## Metadata

Keep existing useful fields as listed in the audit. Preserve unknown fields,
original installedAt, installation mode, Git mode, document name and ownership.
cliVersion means the release last updating project bootstrap/schema metadata;
runtimeVersion means generated asset release. Neither determines compatibility.
Add optional createdWith only at fresh bootstrap; do not invent history for
older projects. Preserve last-project-update information through cliVersion
and an updatedAt timestamp. Missing creation provenance is reported as unknown.

Validate metadata as an object, schema as a positive safe integer, Git mode
as local/shared, and relative ownership/doc paths before using them. Conflicting
metadata/config schema or independent authoritative layouts means BROKEN.
Known unversioned historical layouts are normalized explicitly; missing schema
on arbitrary canonical state is not assumed to be current. Malformed JSON
must fail before writes. Project metadata never authorizes machine deletion.

## Compatibility policy

One side-effect-free evaluator supplies applicationVersion, projectSchemaVersion,
currentSchemaVersion, readable bounds, layout, migrationAvailable, adjacent path,
conflicts and reason. It performs no network operations. Classification:

| State | Behavior |
| --- | --- |
| CURRENT | Canonical schema 3; operations allowed |
| MIGRATION_REQUIRED | Recognized schema 1/2 or known unversioned history; migration available |
| LEGACY_LAYOUT | Recognized old layout; migration path includes layout normalization |
| TOO_NEW | Any authoritative schema exceeds 3; require application update |
| BROKEN | Malformed/contradictory metadata, incomplete migration or unsafe paths |
| NOT_SPECTRA_PROJECT | No recognized project markers |

Minimum normal readable schema is 3, maximum is 3. Schema 1/2 are migratable,
not promised safe for all normal commands. Do not advertise SUPPORTED_OLD until
specific old-schema reads are actually demonstrated. Stale runtimeVersion alone
does not require schema migration; doctor --fix handles replaceable refresh.

Central command preflight runs after alias normalization and before any state
access/mutation. Apply equivalent guards in programmatic install/refresh entry
points so callers cannot bypass safety. Resolve init/adopt positional target,
--cwd and adapters --target correctly, including both source and destination
when necessary. Help/version/update/uninstall are project independent. migrate
and diagnostic status/doctor may print compatibility facts for old/new/broken
projects without invoking state writers; block other operations conservatively.
For CURRENT status preserve existing behavior unless changing its documented
read-only contract requires a small pure approval-inspection option.

## Migration planning and execution

`spectra migrate --check [--cwd <path>]` inspects upward from cwd, including
metadata-only broken markers, and reports schema, layout, compatibility,
available ordered steps and concrete conflicts. It never writes or downloads.
Add --json for deterministic automation; no redundant --dry-run.

`spectra migrate [--cwd <path>] [--yes]` executes the shipped plan. Programmatic
planner/executor have no prompts. CLI requests confirmation in a TTY; without
TTY it fails with instructions to use --yes. Current project is a harmless no-op.
Git mode conversion is excluded; improve the existing misleading error text.

Use existing CLI 0 success / 1 failure convention, with JSON outcome values
current, migration-required, incompatible, failed and invalid-usage. Check of a
pending migration returns 1 with migration-required, avoiding global exit-code
changes. Document both text and JSON outcomes.

Preflight all layout conflicts, source-repo protection, schema/config consistency,
local Git availability and unsafe symlinks before creating a snapshot. Ordered
steps declare from/to, preconditions, mutation and validation. Legacy moves no
longer stamp the latest schema as a side effect. Preserve existing late-manifest
move and target-wins cache merge; do not guess between independent trees.

Before mutations, acquire an exclusive filesystem migration marker and create
a collision-free recovery directory under the project's .spectra area. Store
original metadata/config, authoritative sdd content excluding generated system
assets, user/plugin docs excluding positively owned guides, and affected Git
exclude content. Record a checksum manifest and original paths. Reject symlinks
in mutation/snapshot inputs where traversal would escape the project; do not
silently dereference or overwrite outside paths. Exclude caches, local CLI,
launcher and known generated assets from value snapshots; unknown files are
treated as valuable. Preserve the snapshot across failure and report its path.

Write progress markers atomically. Validate each step's structural/data
postconditions before advancing schema/config atomically; during the short
two-file transition the marker blocks other commands. Do not overwrite existing
user memory/specs/governance. Reuse missing-only scaffolding for 1→2 and 2→3;
refresh generated bootstrap separately after state conversion. Validate final
canonical/schema consistency and existing Spectra checks before success. If
policy checks fail for unrelated application changes, report that validation
failed distinctly; never claim migration complete prematurely. Retry recognizes
completed steps and pending validation. An interrupted marker prompts explicit
resume with --yes after verifying recorded paths/preconditions; conflicting
changes require manual recovery from the retained snapshot. No automatic reverse
schema migration. A marker cannot be cleared simply because schema equals 3.

## Machine ownership, install and update

Add a small ownership record to each native version directory and one machine
record containing stable command location/current activation. No project list.
Records originate from install.sh and bind version, installation method and
canonical installation/executable paths. Validate strict version syntax and
paths; refuse unsafe roots, foreign destinations and symlink traversal before
replacement/deletion. Existing installations require evidence-based adoption
(matching executing native binary, VERSION and runtime layout); arbitrary
lookalike files alone are insufficient deletion authority.

Stage and smoke-test a complete version directory, then atomically rename and
switch the command symlink. Retain previous owned versions for software rollback.
Do not silently overwrite a foreign command. Avoid copying an unbound executable
when link creation fails; report a supported activation failure clearly. Install
does not change shell profiles or create project artifacts.

`spectra update [--yes]` operates outside projects and never invokes internal
project refresh. Detect provenance from executing code/binary and validated
machine records, not its basename alone. Native-managed invocation installs a
requested verified release, activates the stable command and verifies version.
Package-manager-owned npm invocation provides `npm install -g spectra-pack@<v>`
instructions; npx, local fallback and development invocation give precise
bootstrap/install instructions without mutating an unrelated global package.
Keep SPECTRA_LATEST_VERSION test override. An already-current update exits 0.
Retain --cwd as a compatibility input without using it to modify a project.
Internal historical __update-project must refuse implicit state migration and
direct to migrate/doctor rather than remain an unguarded mutation bypass.

## Launcher interaction

New launchers resolve a stable recorded managed command first, then recorded
standalone native fallback, local Node CLI, PATH command and clear failure.
Use verified stable machine provenance at bootstrap, preserve the Windows Node
fallback and existing self-source protection. Avoid recursion through another
project launcher or a symlink alias of self.

Already-generated launchers cannot be magically rewritten without visiting
projects. During a managed native update, retained owned version executables
need safe forwarding to the active managed command so old recorded paths use
current software without project scans. Preserve old executable bytes for
explicit application rollback; forward only verified owned paths, atomically.
An unmanaged standalone binary remains intentionally pinned until a project
bootstrap refresh. This limitation is documented and tested. After uninstall,
local Node fallback remains usable; native-only fallback requires reinstall
unless another machine command exists. Do not claim native projects contain a
Node fallback when they do not.

## Uninstall

`spectra uninstall [--yes]` plans owned native version removal and removal of
the matching stable command only. Revalidate immediately before each deletion;
reject mismatched link targets, symlinked version roots, foreign markers and
dangerous configured roots. Remove all positively owned installed versions;
preserve unrecognized entries and shared parent directories. Remove machine
records only after owned artifact removal succeeds. Interrupted uninstall can
be retried and names remaining owned artifacts. TTY confirmation is required
unless --yes; non-TTY must not wait for input.

For global npm provide `npm uninstall -g spectra-pack`; for npx, project fallback,
development and unowned standalone distributions report no managed installation
and instructions. Do not self-delete npm files or trust project binaryPath as
ownership. Never inspect/remove project directories, knowledge, Git exclusions
or adapters. Uninstall/reinstall must preserve two independent projects byte
for byte. Application rollback is separate from project rollback; TOO_NEW
protection applies after downgrade.

## Artifact lifecycle

| Artifact | Install | Update | Uninstall |
| --- | --- | --- | --- |
| Owned version runtime/assets/VERSION/LICENSE | Stage and create | Retain old; activate verified new | Remove positively owned versions |
| Stable command symlink | Create if safe | Atomic repoint | Remove only matching owned link |
| Machine/version ownership records | Create | Atomic update | Remove own records after artifacts |
| Old managed executable forwarding | Absent initially | Preserve executable; atomic forward | Remove inside owned versions |
| Shell profile / shared bin/share parents | No changes | No changes | Preserve |
| Project .spectra and Git policy | Bootstrap only | No changes | Never touch |

## Verification before implementation and delivery

Write E2E checks before product code. Record failure modes first for any isolated
system check. Reuse Node's installed runner and release verifier, no framework.
Every lifecycle run retains JSON commands, statuses, inventories and SHA-256
value-file checks in a repeatable run directory. Update old tests to assert
explicit migration and project-independent update before the refactor.

Matrix includes real projects generated by v2.0.3, a schema-1 historical commit,
v3.0.8, v3.0.9/v3.1.0, v3.1.1 and v3.1.2 as practical. Record source SHA/version,
layout/schema, Git mode, path, value-file checksums and regenerated files. Cover
local/shared, no metadata, malformed schema, newer schema, parallel roots,
source repo, stale runtime, incomplete markers and repeat migration. Inspect
historical generation dependencies rather than fabricating unknown formats.

Inject collision, write/validation/Git/launcher failures and interruption;
prove value preservation, honest completion and retry/recovery. Guard every
command/alias against newer schema with unchanged inventories. Exercise npm
pack and native archive, no-Node native PATH, machine update outside/inside two
projects, old recorded launchers, local fallback, custom roots, retained versions,
foreign links, uninstall, project preservation and reinstall. Wire packaged
verifier and artifacts into native release CI for all supported targets.

Run actual gates: npm ci, npm test, npm run check, parity, npm pack, native build,
existing native smoke, enhanced packaged verifier and git diff --check. Only
claim target/platform behavior actually verified locally or in CI. Update README,
getting-started, native guide, canonical/installed CLI references, help, command
effects/count (23), release notes and final report. Record baseline and final
test totals separately, plus migration/update/uninstall matrices.

## Deferred scope

No detach, Git-mode conversion, reverse migrations, external project storage,
global project registry, ADE/run/orchestration, worktrees, provider abstraction,
Experience Memory, Run Traceability or Knowledge/Context redesign. No release
publication or deployment is implied by local implementation.
