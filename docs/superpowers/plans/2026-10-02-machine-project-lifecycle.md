# Machine application and project lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method awaits user selection; do not delegate without authorization.

**Goal:** Separate the machine application lifecycle from explicit, safe per-project migration while retaining corporate fallback.

**Architecture:** Extend the current installer and filesystem state. Share one compatibility evaluator between command preflight and migration planning; reuse existing layout moves, bootstrap refresh and validation behind explicit lifecycle boundaries. Prove native ownership before machine mutation.

**Tech Stack:** Existing Node ESM, node:test/assert, POSIX shell, Node SEA, yaml and esbuild; no new dependencies.

**Spec:** [Approved lifecycle design](../specs/2026-10-02-machine-project-lifecycle-design.md).

## Global Constraints

- Current-main audit must precede product code; baseline main is e3aca715, content-identical to checkout e683257.
- Normal readable schema minimum/maximum is 3; migrate known schema 1/2 and known unversioned history; feature API stays spectra/v2.
- Application baseline is 3.1.2; no release number or publication is chosen by this plan.
- Project state stays in .spectra; machine update/uninstall never scans for projects.
- local remains default, shared explicit; migration preserves mode and user ownership.
- Never write unit tests after code. Prefer E2E; list failure modes before isolated checks.
- Retain self-contained Node fallback and its realpath self-deletion protection.
- Validate trusted boundaries, paths, schema, symlinks and deletion ownership.
- No ADE, detach, reverse schema migration, registry, external store or Context redesign.

## Review Focus

- A adapters --target points at a different newer-schema project: neither source nor target may mutate (Task 2).
- A symlink or nested project path selects the same state: preflight and fallback self-identity must agree (Tasks 2/6).
- A migration is interrupted after one metadata file changes: marker must prevent a false-current verdict (Task 4).
- A same-version native reinstall faces a foreign command/version path: preserve it and fail before activation (Task 5).
- An uninstall runs while another activation changes the command: revalidation must preserve unexpected targets (Task 7).

## File responsibilities

- Existing lib/project-layout.js: layout/path/upward discovery, including broken project markers.
- New lib/project-compatibility.js: pure inspection and command compatibility policy.
- Existing lib/install-metadata.js: schema contract and backward-compatible provenance construction.
- Existing lib/migration.js: pure legacy preflight and retry-safe filesystem moves; no implicit latest-schema stamp.
- New lib/project-migration.js: adjacent registry, planner, snapshot/marker executor.
- New commands/migrate.js: options, confirmation, human/JSON outcomes.
- Existing lib/install.js: guarded fresh bootstrap/replaceable refresh, retained metadata and launcher resolver.
- New lib/application-installation.js: machine ownership/provenance and safe removal planning/execution.
- Existing lib/update.js and commands/update.js: project-independent software update.
- New commands/uninstall.js: confirmation and provenance-specific removal/instructions.
- Existing main.js/status.js/doctor.js/help.js: centralized preflight and public lifecycle UX.
- New test/lifecycle-e2e.test.js: retained scenario evidence; extend tools/verify-release.mjs for distributions/history.
- install.sh: verified native staging/activation/ownership; existing release workflows run expanded gates.

### Task 1: Freeze baseline and write lifecycle E2E before implementation

**Files:** docs/lifecycle-current-main-audit.md; new packages/cli/test/lifecycle-e2e.test.js; existing test/update.test.js, unified-install-e2e.test.js and command-effects-e2e.test.js.

**Interfaces:** Reuse helpers/project.js spectra(root,args) and localSpectra(root,args). Test evidence includes scenario, commands, exit statuses, before/after SHA-256 inventories, source version/layout/schema, authoritative files and regenerated paths.

- [x] Record final baseline count/status/log and current strict/parity checks in audit.
- [x] Write E2E with named failure modes: update outside project, implicit migration, new-schema writes, missing/corrupt state, unsafe uninstall, fallback pinning and value loss. Retain evidence even on failure.
- [x] Add assertions before production changes: current-version update outside project exits 0 with unchanged two-project inventories; migrate --check on schema 2 returns migration-required and unchanged inventory; migrate --yes preserves brief/docs and produces schema 3; repeat invocation is a no-op; uninstall never touches projects.
- [x] Move old update migration assertions to explicit migrate expectations; retain interactive decline and validation-failure cases. Remove the obsolete outside-update project-required assertion.
- [x] Run `node --test packages/cli/test/lifecycle-e2e.test.js`; confirm failures identify missing lifecycle behavior, not fixture setup.

### Task 2: Authoritative compatibility and command preflight

**Files:** new lib/project-compatibility.js; lib/project-layout.js; src/main.js; commands/status.js, doctor.js; lib/install.js; lifecycle E2E.

**Interfaces:** `inspectProjectCompatibility(projectRoot) -> {status, applicationVersion, projectSchemaVersion, currentSchemaVersion, minimumReadableSchema, maximumReadableSchema, layout, migrationAvailable, migrationPath, reason, conflicts}`. `assertProjectOperationAllowed(projectRoot, operation) -> compatibility` throws before writes. Status/diagnostic paths use inspection without loading unknown contracts.

- [x] Extend E2E before code: schema 4/negative/fraction/string values, malformed JSON, missing manifest/metadata, parallel roots, config mismatch; every command/legacy alias must preserve inventories when rejected. Test --cwd upward/nested/symlink paths and adapters --target to a second newer project.
- [x] Run focused test and confirm unsupported schemas currently bypass safety.
- [x] Implement pure inspection with existing layout probes and metadata reading, validating all candidate authorities. Separate recognized unversioned history from unexplained missing schema. Expose source-repo and incomplete-marker facts.
- [x] Guard dispatch after alias normalization, resolve command-specific targets and allow project-independent help/version/update/uninstall. Guard installSpectra programmatic entry before migration/Git/bootstrap work. Let status/doctor report old/new compatibility without invoking approval/state writers.
- [x] Run lifecycle E2E and existing layout/grammar/status tests; verify current operations and source-repo checks remain functional.
- [x] Review diff, then commit this cohesive safety change when its checks pass.

### Task 3: Separate software update and project bootstrap refresh

**Files:** commands/update.js; lib/update.js; lib/install.js; lib/install-metadata.js; commands/doctor.js; update E2E.

**Interfaces:** `refreshProjectRuntime(projectRoot) -> install result` requires CURRENT and preserves original metadata; `runSelfUpdate(latest, installation, options) -> exit status` has no projectRoot argument. Provenance comes from Task 5; until native ownership exists, decline native mutation with precise instructions rather than guessing.

- [x] Write assertions first: update inside/outside current/old/new/broken project changes no project bytes; local Node/npx/source update never silently changes a global package; doctor --fix refuses old schema yet repairs replaceable current files.
- [x] Run focused E2E and observe obsolete update behavior fail.
- [x] Remove project discovery, migration and refresh from public update. Keep latest discovery/override and version comparison. Handle non-TTY confirmation explicitly. Retain --cwd compatibility without state mutation.
- [x] Preserve metadata unknown fields, installedAt, gitMode, docs/ownership; add createdWith for fresh bootstrap and updatedAt for explicit project update. Keep cliVersion/runtimeVersion roles separate. Prevent init/adopt/doctor from performing hidden migration.
- [x] Make __update-project return precise migrate/doctor guidance without an unsafe refresh bypass. Update misleading Git-mode error; no conversion option.
- [x] Run update/layout/doctor/fallback preservation E2E; review and commit when green.

### Task 4: Explicit migration registry, snapshot executor and command

**Files:** lib/migration.js; new lib/project-migration.js; new commands/migrate.js; main.js; help.js; lifecycle E2E and existing migration tests.

**Interfaces:** `planProjectMigration(projectRoot) -> {compatibility, steps, conflicts, required}`; `executeProjectMigration(projectRoot, plan) -> {status, projectSchemaVersion, recoveryPath, validationStatus}`. Steps expose fromSchema/toSchema/preconditions/mutation/validation; no prompt/network. Existing migrateLegacyLayout remains callable but no longer advances current schema prematurely.

- [x] Write checks before code: schema 1→2→3, 2→3, known unversioned normalization, each historical layout, non-mutating --check/--json, invalid usage outcome, non-TTY --yes instruction, decline, repeated success and Git-mode preservation.
- [x] Add failure injection scenarios for conflicts, exclusion writes, schema transition, validation, launcher refresh and interruption. Assert hashes of specs/governance/memory/plugin docs remain intact, marker retains precise phase, failed completion is not CURRENT and recovery path is reported.
- [x] Run migration-focused tests; confirm missing explicit planning/engine failures.
- [x] Extract pure legacy conflict preflight; preserve unconditional source-repo guard, late manifest move, target-wins cache merge and user exclusion ownership. Reject malformed metadata and escaping symlinks instead of empty-object guessing.
- [x] Implement adjacent shipped registry, collision-free value snapshot/checksum manifest and exclusive progress marker. Preserve valuable unknown files; skip derived cache/local CLI/known generated files. Advance step metadata/config only after step validation; blocked marker makes intermediate state diagnosable.
- [x] Add explicit resume of recorded safe phases with --yes; conflicts require manual recovery. Preserve snapshot on failure, distinguish final project-policy validation failure from mutation failure.
- [x] Implement migrate check/execute text and JSON outcomes with existing 0/1 exit convention. Current migrate is no-op; no --dry-run.
- [x] Run migration and current-schema functional checks; inspect artifacts and repeat invocation; review and commit when green.

### Task 5: Native installation ownership and application update

**Files:** install.sh; new lib/application-installation.js; lib/update.js; commands/update.js; tools/verify-release.mjs; lifecycle E2E.

**Interfaces:** `inspectApplicationInstallation({env, execPath, packageRoot}) -> {kind, home, commandPath, currentVersion, versions, reason}` where kind is native-managed/npm/npx/local-fallback/development/unmanaged. `planApplicationUpdate(installation, version) -> plan`; native updater stages/activates then verifies exact version. Installer ownership records bind canonical paths/version/method; none contains project paths.

- [x] Add real-installer transport tests before code: bad checksum, malformed VERSION/traversal, foreign command/version, symlinked installation root, custom home/bin, same-version reinstall, retained old version and interrupted staging.
- [x] Run packaged installer checks and confirm current unsafe ownership behavior.
- [x] Validate versions/roots before deletion; stage complete extracted runtime and smoke-test it before atomic activation. Create ownership records; preserve foreign/shared files, prior command on failure and earlier owned versions. Do not use copied-unbound executable fallback.
- [x] Implement provenance from actual executing package/binary and validated records. Legacy adoption requires verified executing identity/version/runtime evidence; do not infer ownership from a directory name or project metadata.
- [x] Connect native-managed update with version pinning and exact activation verification; npm gives package-manager update command, ephemeral/source/fallback give actionable installation instructions. No project scan or writes.
- [x] Run packaged E2E outside and inside two projects, custom locations, no-Node PATH and activation failure; confirm checksum/inventory evidence; review and commit.

### Task 6: Stable machine resolution and corporate fallback

**Files:** lib/install.js; application-installation.js; install.sh; tools/verify-release.mjs; lifecycle E2E.

**Interfaces:** Project metadata retains binaryPath and optional stable machine command; launcher resolver executes stable managed command, recorded standalone native, local Node fallback, safe PATH command, then exit 127. Managed old recorded executable locations forward atomically to current activation while retaining rollback bytes.

- [x] Write tests before code for an actually generated old native launcher across machine update, recorded custom path without PATH, standalone pin, Node fallback with no machine, PATH fallback, recursion via symlink aliases and self-refresh using symlink project path.
- [x] Run checks; confirm retained versioned launchers remain pinned today.
- [x] Generate stable managed resolution only from verified provenance. Keep source-fallback materialization realpath guard and Windows Node launcher. Check self identity before PATH exec.
- [x] During native update, preserve old executable bytes and forward only owned retained version paths to stable current command without visiting project directories. Keep explicit rollback activation separate from project migration.
- [x] Run both distribution launcher parity, native no-Node and local self-refresh checks; inspect unchanged project inventories; review and commit.

### Task 7: Ownership-safe uninstall and reinstall

**Files:** application-installation.js; new commands/uninstall.js; main.js; help.js; lifecycle E2E; tools/verify-release.mjs.

**Interfaces:** `planApplicationUninstall(installation) -> {versions, commandPath, records, preserved}`; `executeApplicationUninstall(plan) -> {removed, preserved}` revalidates each target; no projectRoot input.

- [x] Add tests before code for default/custom roots, multiple owned versions, unexpected symlink, foreign entries, symlink traversal, target changing after planning, no-TTY/--yes, non-native provenance and two preserved projects.
- [x] Run and confirm uninstall missing/failing behavior.
- [x] Implement ownership-only removal and precise package-manager/bootstrap guidance. Require TTY confirmation or --yes; preserve unexpected links, unowned versions and shared parent directories. Keep failures retryable with remaining artifacts reported.
- [x] Exercise install→adopt A/B→use→uninstall→fallback where present→reinstall→compatibility→migrate if required→use; assert project hashes and Git exclude byte preservation across machine operations.
- [x] Run uninstall/reinstall matrix in packaged npm/native E2E; review artifacts and commit when green.

**Task 7 verification:** `tools/verify-release.mjs` passed for npm/native 3.1.2; retained artifact: `/private/tmp/spectra-task7-release-final3/run-yuHll2/results.json`. Recordless legacy native installs remain untouched and require a newer recorded managed installation before uninstall; automatic review rejected uninstall-time ownership adoption as unauthorized scope.

### Task 8: Historical dogfood, docs and release gates

**Files:** tools/verify-release.mjs; native-release.yml; smoke-native.sh; README.md, CHANGELOG.md, RELEASE_SUMMARY.md; docs/getting-started.md, native-install.md, cli-reference.md; matching profiles/full/docs files; new docs/lifecycle-verification.md and JSON artifact.

**Interfaces:** Release verifier accepts existing version/npm/native/output arguments; matrix records source SHA/version/layout/schema/gitMode, required path/final state and authoritative before/after hashes. CI uploads retained results on failure as well as success.

- [x] Before wiring implementation, add real-generation historical scenarios using git tags/commit archives in isolated temporary directories: v2.0.3, schema-1 historical commit, v3.0.8, v3.0.9/v3.1.0, v3.1.1 and v3.1.2. Pack/bootstrap using each release's actual entrypoints/assets/dependencies; record limitations honestly.
- [x] Run migration/check/normal-command dogfood on each generated state; exercise current machine adoption against multiple projects, downgrade protection, retry failures and launcher retention through the packaged/native matrix. No fabricated replacement for available historical metadata.
- [x] Update public help (23 commands) and canonical/installed guide parity. Explain install-once, software-only update, per-project migrate/check/yes/json, safe uninstall, provenance, retained versions/rollback, schema/API separation and corporate fallback limits. Correct status effects and old update diagrams/tests.
- [x] Wire npm pack plus enhanced packaged verifier into four-target native release CI; retain checksum verification and no-Node smokes. Upload machine-readable lifecycle evidence.
- [x] Run `npm ci`, `npm test`, `npm run check`, `node packages/cli/scripts/check-versions.mjs`, npm pack, native build, smoke-native.sh, packaged verifier and `git diff --check`; fix failures and rerun only affected checks before final necessary gates.
- [x] Inspect retained E2E artifacts and report baseline/final test count, passes/failures, npm/native/history/update/uninstall matrices and platform limitations. Write concise final architecture report covering all user-requested A–K topics; list only real deferrals.
- [x] Final whole-diff review against acceptance invariants; commit completed verified changes. Do not publish or claim untested platforms.
