# Spectra Lite/Full Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify Spectra’s public workflow while introducing Lite and Full profiles, a single generated `./spectra` boundary, safe local Git behavior, update/migration support, and parity between Node and native installations.

**Architecture:** Keep one repository and one CLI. Store profile assets in `profiles/lite` and `profiles/full`, keep shared executable/template logic in `packages/cli` and `packages/templates`, and generate all Spectra-owned project files beneath `./spectra`. Preserve legacy layouts through explicit detection and migration.

**Tech Stack:** Node.js ESM CLI, shell runtime scripts, npm workspaces, Node SEA native artifacts, Node test runner.

## Implementation Status

Verified complete on 2026-07-10. All ten task areas, including the planned command/module boundaries, template profile resolution, asset synchronization, native smoke script, installer verification, and profile/runtime version parity checks, are implemented and covered by fresh verification. A follow-up hardening review fixed atomic migration, legacy exclusion replacement, direct native update resolution, post-update checks, resumable status reporting, and profile-aware help. See `2026-07-10-plan-gap-hardening.md`.

## Global Constraints

- Lite is the default profile.
- Local Git mode is the default for both `init` and `adopt`.
- Local mode excludes only `spectra/` through `.git/info/exclude` and does not modify `.gitignore`.
- Shared mode makes `spectra/` commit-ready.
- Generated projects must not create root-level `sdd/`, `.spectra/`, `docs/`, `app/`, or `.github/` directories for Spectra-owned content.
- `spectra update` updates the CLI and project runtime after one confirmation and reports when already current.
- Keep one synchronized public Spectra version; add a separate project schema version.
- Native macOS/Linux installation without Node or npm remains supported.
- Existing top-level commands remain compatibility aliases until migration is complete.

---

### Task 1: Establish profile and path contracts

**Files:**
- Create: `packages/cli/src/lib/project-layout.js`
- Create: `packages/cli/src/lib/profile.js`
- Create: `packages/cli/test/project-layout.test.js`
- Create: `packages/cli/test/profile.test.js`

- [x] Write failing tests for canonical `spectra/` paths, Lite defaulting, Full selection, and metadata shape.
- [x] Run `npm test --workspace spectra-pack` and confirm the new tests fail for missing helpers.
- [x] Implement path/profile helpers with explicit `profile`, `cliVersion`, `runtimeVersion`, `schemaVersion`, and `gitMode` fields.
- [x] Run the focused tests and then the existing CLI test suite.

### Task 2: Move repository-owned profile assets

**Files:**
- Create: `profiles/lite/`
- Create: `profiles/full/`
- Modify: `packages/templates/src/index.js`
- Modify: `packages/cli/src/lib/runtime.js`
- Modify: `packages/cli/scripts/sync-assets.mjs`
- Test: `packages/templates/test/` and asset synchronization tests

- [x] Add failing asset-resolution tests for Lite and Full profile roots.
- [x] Move minimal shared SDD assets into Lite and advanced governance assets into Full without deleting legacy source files yet.
- [x] Update asset synchronization to package both profiles.
- [x] Verify templates can be resolved from npm and native build inputs.

### Task 3: Generate the new `./spectra` layout

**Files:**
- Modify: `packages/cli/src/lib/install.js`
- Modify: `packages/cli/src/lib/runtime.js`
- Modify: `packages/cli/src/commands/init.js`
- Modify: `packages/cli/src/commands/adopt.js`
- Modify: `packages/cli/test/adopt-local.test.js`
- Create: `packages/cli/test/install-layout.test.js`

- [x] Add failing tests asserting Lite `init` and `adopt` create only `spectra/`-owned content.
- [x] Add `--profile lite|full` and `--git-mode local|shared` parsing to setup commands.
- [x] Make Lite/local the default.
- [x] Write launcher, CLI fallback, docs, SDD files, config, and install metadata under `spectra/`.
- [x] Do not create root `app`, `docs`, `.github`, `sdd`, or `.spectra` directories for generated Spectra content.
- [x] Run focused install/Git tests and the complete CLI suite.

### Task 4: Preserve and simplify Git policy

**Files:**
- Modify: `packages/cli/src/lib/git-policy.js`
- Modify: `packages/cli/test/git-policy.test.js`
- Modify: `packages/cli/test/adopt-local.test.js`

- [x] Add failing tests for exclusion of only `/spectra/`, unchanged `.gitignore`, visible application files, and shared mode.
- [x] Update managed-path detection and metadata from `.spectra`/`sdd` to `spectra`.
- [x] Add compatibility handling for legacy exclusions.
- [x] Verify local and shared behavior in clean temporary Git worktrees.

### Task 5: Add `help`, `check`, and improved `status`

**Files:**
- Modify: `packages/cli/src/main.js`
- Create: `packages/cli/src/commands/help.js`
- Create: `packages/cli/src/commands/check.js`
- Modify: `packages/cli/src/commands/status.js`
- Create: `packages/cli/src/lib/status-report.js`
- Create: tests for help/check/status

- [x] Write failing CLI tests for `spectra help`, command help, `help advanced`, and profile-aware output.
- [x] Implement concise workflow help while preserving `--help` and legacy commands.
- [x] Write failing tests for `spectra check` delegating to the appropriate Lite/Full validation behavior.
- [x] Implement `check` as the public health/verification entry point.
- [x] Write failing tests for status summaries of memory-bank, Markdown, code, approval, and next-action state.
- [x] Implement status reporting without time-window flags.

### Task 6: Implement version metadata and `spectra update`

**Files:**
- Modify: `packages/cli/src/lib/version.js`
- Create: `packages/cli/src/lib/update.js`
- Create: `packages/cli/src/commands/update.js`
- Modify: `packages/cli/src/main.js`
- Modify: `packages/cli/src/lib/install.js`
- Create: update tests

- [x] Add failing tests for current version, newer version, already-current output, confirmation decline, and confirmation acceptance.
- [x] Add schema/profile/runtime fields to `install.json`.
- [x] Implement latest-version discovery using the installation channel’s existing release source.
- [x] Implement one confirmation for CLI and project runtime updates.
- [x] Refresh only Spectra-owned files and preserve user files.
- [x] Add “already up to date” behavior.

### Task 7: Add legacy layout migration

**Files:**
- Create: `packages/cli/src/lib/migration.js`
- Create: `packages/cli/test/migration.test.js`
- Modify: `packages/cli/src/lib/update.js`
- Modify: `packages/cli/src/lib/runtime.js`

- [x] Write failing migration tests for `.spectra` plus `sdd`, legacy docs, local excludes, shared ignores, and conflicts.
- [x] Detect legacy installs via `.spectra/install.json` and `sdd/system/manifest.env`.
- [x] Move Spectra-owned files to `spectra/` with conflict checks.
- [x] Rewrite internal path references and metadata.
- [x] Replace legacy local exclusions with `/spectra/`.
- [x] Run `spectra check` after migration and report actionable failures.

### Task 8: Group Full commands and retain compatibility aliases

**Files:**
- Modify: `packages/cli/src/main.js`
- Create: `packages/cli/src/commands/admin.js`
- Modify: command-specific tests and CLI reference docs

- [x] Add failing dispatch tests for `spectra admin approve|eval|diff|adapters|doctor`.
- [x] Route grouped commands to existing implementations.
- [x] Keep old top-level command dispatch available as compatibility aliases.
- [x] Hide advanced commands from default help while documenting them under `help advanced`.

### Task 9: Native packaging parity

**Files:**
- Modify: `packages/cli/scripts/build-native.mjs`
- Modify: `packages/cli/scripts/check-versions.mjs`
- Modify: `.github/workflows/native-release.yml`
- Modify: `install.sh`
- Modify: native smoke tests and documentation

- [x] Add failing native smoke tests for Lite, Full, help, status, check, update metadata, and new layout.
- [x] Bundle both profiles in native artifacts.
- [x] Keep native and npm versions synchronized.
- [x] Verify macOS/Linux installation without Node/npm.
- [x] Verify native project-local launchers use `spectra/`.

### Task 10: Documentation and release migration

**Files:**
- Modify: `README.md`
- Modify: `docs/cli-reference.md`
- Modify: `docs/native-install.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/structure.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE_SUMMARY.md`

- [x] Document Lite and Full profiles.
- [x] Document the new generated structure.
- [x] Document local/shared Git behavior.
- [x] Document `help`, `check`, `status`, and `update`.
- [x] Document migration from the current layout.
- [x] Document the synchronized release version and project schema version.
- [x] Run all repository validation and release checks.

## Versioning policy

- Keep one public version synchronized across root/package manifests, CLI version output, runtime assets, profile assets, npm package, and native artifacts.
- Store `schemaVersion` separately in project metadata.
- Patch releases are safe fixes; minor releases add compatible capabilities; major releases may remove legacy paths or aliases.
- The root-level-to-`spectra/` migration is a breaking layout change and should ship with an explicit migration path and release notes.

## Verification commands

```bash
npm test --workspace spectra-pack
npm test
npm run validate
npm run verify
```

Native release verification must additionally exercise `help`, `version`, `init`, `adopt`, local Git mode, shared Git mode, `status`, `check`, and the repo-local launcher on supported macOS/Linux artifacts.
