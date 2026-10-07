# Release Summary

## v3.1.3

Adds Project Intelligence queries and verification evidence on top of the existing deterministic project knowledge, and separates the machine lifecycle from the project lifecycle. The `spectra/v2` identifier and installation schema version 3 are unchanged; no project migration is required.

- `spectra inspect <id>` explains what governs one rule, requirement, scenario, invariant, module or test target and whether it is verified. `inspect --changed`, `--base <ref>` and `--file <path>` report the impact of changed files at module and canonical-source level, not a code graph.
- `spectra verify --test-target <id>` records scoped, local verification evidence. Subjects report `verified`, `failed`, `stale` or `unverified`; `verify --explain <id>` says why, and `verify --gate review|release` reports whether the evidence lets a stage proceed. Passing evidence supports the subjects that declare it; it does not prove a requirement everywhere.
- `spectra update` changes the machine application only and never touches a project. `spectra migrate` is the explicit per-project step and `spectra uninstall` removes the native application while leaving every project unchanged. Derived caches rebuild on their own and never need a migration.
- `context --route-task` selects exact knowledge objects within the role budget, now also matches architectural invariants, and folds `-ing`/`-ed` term variants. Retrieval stays deterministic, lexical and budget-aware; there is no semantic or vector search.
- Generated agent guidance covers route-first context, business memory, Project Intelligence commands and the verification gates. Agent-facing JSON carries `contractVersion` 1 and structured errors.
- After updating an existing project, run `spectra doctor --fix` and then `spectra adapters --agents <csv>` to receive the new guidance. Handwritten `AGENTS.md` and `CLAUDE.md` files are never overwritten without `--force`. Updating from 3.1.2 may end with a note that the old project-update step is retired; the application is updated and no project file changed.
- Documentation and the website describe all 24 commands, local vs shared mode and the three lifecycles.

## v3.1.2

Improves adoption discovery, project documentation ownership and the command-effect guides following 3.1.1. The `spectra/v2` schema identifier and installation schema version 3 remain unchanged.

- Adoption projects repository evidence into discovery documents without running application commands or treating technical findings as confirmed business intent.
- Compatible plugin and skill documents are directed by generated agent guidance to `.spectra/docs/<project-name>/<plugin-or-skill>/`; tool-required paths remain supported. Install metadata keeps the project documentation name stable across later brief changes.
- Runtime refresh preserves user memory, plugin documents and unowned guide collisions. Explicit adapter generation follows the target project's ownership policy.
- Refreshing through the project-local npm launcher preserves its own CLI and runtime files, keeping `doctor --fix` and repeated installation usable.
- All 21 public commands have documented file effects, and the website diagrams match the site's typography and cards while retaining complete explanations.
- After updating an existing project, regenerate its agent instructions with `spectra adapters --agents <csv>` to receive the new output guidance. Existing plugin documents are not automatically moved.

## v3.1.1

Consolidates installation around the Full runtime without profile selection and makes `spectra verify` release-ready by default, including nested release-checklist enforcement. Release approvals persist across invocations, reject dirty project changes, and become invalid after relevant semantic scope changes. Also fixes native context refresh, generated adapter state paths, and Lite context guidance. The `spectra/v2` schema identifier is unchanged.

## v3.1.0

Post-consolidation correctness release. The public Full commands remain top-level, canonical project state remains under `.spectra/`, and the `spectra/v2` schema identifier is unchanged.

- Fixes the release approval deadlock and rejects stage skipping from draft.
- Repairs canonical-path handling in shell-backed checks and invalidates approvals after relevant project-brief or feature-spec edits.
- Protects user files during installation and preserves user-written agent adapters.
- Publishes native archives and checksums for macOS and Linux on arm64 and x64. See [CHANGELOG.md](CHANGELOG.md) for the full change list.

## v2.0.2

### Brownfield Status Accuracy
- Detects tests across repository layouts instead of assuming application code lives under `app/`.
- Ignores traceability examples inside comments and reports only real requirement rows.
- Distinguishes untouched templates, uncommitted specs, and committed spec history.

### Release Safety
- Adds a Java-style brownfield adoption fixture to every native artifact smoke test.

## v2.0.1

### Feature: Native Install Path
- Added `curl | sh` installation for macOS and Linux through GitHub Release artifacts.
- Added repo-local `.spectra/bin/spectra` launchers during `init` and `adopt`.

### Product Simplification
- Removed the public `spectra feature` scaffolding command.
- Kept executable spec bundles as first-class project state generated by `init` and `adopt`.

## v2.0.0

### Feature: Agent-Independent Canonical Runtime
- Moved the canonical Spectra runtime from `sdd/.agent/` to `sdd/system/`.
- Added `sdd/system/manifest.env` and `sdd/system/runtime/context-packs.tsv`.
- Removed committed root adapter artifacts from the Spectra source repository.

### Feature: Consumer Adapter Generation
- Added `scripts/generate-adapters.sh` for `Claude Code`, `Cursor`, `Windsurf`, `GitHub Copilot`, `Codex`, and `Antigravity`.
- Kept the canonical source adapter-neutral while allowing generated instruction files in consumer repositories.

### Feature: Workflow Expansion
- Added brownfield discovery with `scripts/map-codebase.sh`.
- Added pre-execution discussion with `scripts/discuss-task.sh`.
- Added handoff verification with `scripts/verify-work.sh`.
- Added lightweight non-app execution with `scripts/quick.sh`.

### Operational Outcome
- Established a breaking-change v2 foundation where rules, manifests, and state are tool-agnostic.
- Preserved installability and CI validation while moving all agent-specific behavior to generated artifacts.
