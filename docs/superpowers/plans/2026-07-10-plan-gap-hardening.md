# Spectra Plan-Gap Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix update, migration, status, and help gaps found in the Lite/Full architecture review.

**Architecture:** Keep existing command dispatch and profile layout. Extract small testable helpers for executable resolution, migration preflight/exclusion normalization, recent Git paths, and profile-aware help.

**Tech Stack:** Node.js ESM, Node test runner, Git CLI, shell-based native runtime.

## Global Constraints

- Preserve the `./spectra/` generated boundary.
- Preserve Lite/local defaults and compatibility aliases.
- Do not require Node/npm for native use.
- Do not delete or overwrite company files.
- Implement each behavior test-first.

---

### Task 1: Make migration atomic and normalize Git exclusions

**Files:**
- Modify: `packages/cli/src/lib/migration.js`
- Modify: `packages/cli/test/migration.test.js`

- [x] Add tests proving conflicts leave `.spectra/`, `sdd/`, and docs untouched.
- [x] Add tests proving local mode replaces known legacy exclusions and preserves unrelated entries.
- [x] Add a shared-mode test proving Git exclusions are unchanged.
- [x] Implement full preflight before filesystem moves and deterministic exclusion normalization.
- [x] Run `node --test packages/cli/test/migration.test.js`.

### Task 2: Harden update and run post-update checks

**Files:**
- Modify: `packages/cli/src/commands/update.js`
- Modify: `packages/cli/test/update.test.js`

- [x] Add tests for direct native executable resolution and newer-version dispatch without network.
- [x] Add tests proving accepted migration invokes project checking and propagates failures.
- [x] Implement injectable command execution and resolve the installed native binary from `SPECTRA_BIN` or the default install location.
- [x] Run the profile-aware check after refresh/migration.
- [x] Run `node --test packages/cli/test/update.test.js`.

### Task 3: Make status represent resumable project work

**Files:**
- Modify: `packages/cli/src/lib/status-report.js`
- Modify: `packages/cli/test/install-layout.test.js`

- [x] Add tests for latest-commit source and nested Markdown paths.
- [x] Add a test proving untouched generated templates are omitted.
- [x] Implement recent Git commit collection and meaningful resume-file filtering.
- [x] Run the focused install/status tests.

### Task 4: Add profile-aware help

**Files:**
- Modify: `packages/cli/src/commands/help.js`
- Modify: `packages/cli/src/main.js`
- Modify: `packages/cli/test/help.test.js`

- [x] Add Lite, Full, and outside-project help tests.
- [x] Pass current working-directory profile context into help rendering.
- [x] Keep advanced commands hidden from default Lite help.
- [x] Run `node --test packages/cli/test/help.test.js`.

### Task 5: Verify the completed hardening pass

- [x] Run `npm test --workspace spectra-pack`.
- [x] Run `node packages/cli/scripts/check-versions.mjs`.
- [x] Run `git diff --check`.
- [x] Build with the cached official Node 22 runtime and smoke Lite/Full native setup, status, check, and update.
- [x] Record implementation status in the original architecture plan.
