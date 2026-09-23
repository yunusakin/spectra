# Changelog

## [Unreleased]

Targets `v3.1.0`. Post-consolidation correctness release. No new product capabilities; the `spectra/v2` schema identifier is unchanged.

### Fixed
- **Release approval deadlock.** `verify --profile release` required `release-approved`, the state `approve --stage release-approved` was trying to grant. Release readiness now requires at least `implementation-approved`, so the documented sequence can succeed.
- **Approval stages can no longer be skipped from `draft`.** `draft -> technical-approved` (and further) was accepted and left `current_state` ahead of the computed `highest_valid_state`.
- **Release approval enforces `verify-work.sh`.** `approve --stage release-approved` previously assumed the shell checks passed; it now runs them through the same runner as `spectra verify`.
- **Canonical `.spectra` root for shell-backed commands.** `spectra diff init/update` failed with a false "missing .git" error in every canonical project; `spec-diff.sh` now checks for a Git work tree and reports data-root-relative paths (which also makes its exclude list effective). `spec-diff.sh --patch` no longer fails on a stray command substitution or on empty change categories under bash 3.2.
- **Policy path namespaces.** `check-policy.sh` compared repo-root-relative tracked paths and data-root-relative untracked paths against `sdd/...` patterns, so results depended on Git state. All modes now use data-root-relative paths. Note: tracked, uncommitted edits under `sdd/` were previously invisible to the "progress.md must be updated" rule in canonical projects; they now count, as intended.
- **`health-check.sh`** scans the project (not `.spectra`) for tests and reads `install.json` from the data root. Scripts now receive `SPECTRA_DATA_ROOT` alongside `SPECTRA_PROJECT_ROOT`; `SPECTRA_REPO_ROOT` remains as a legacy alias for the data root.
- **Install no longer deletes user files.** Finder-artifact cleanup is limited to `.spectra/`; previously it removed `.DS_Store` files anywhere in the project.
- **`spectra doctor`** does not require `node` on `PATH` when running as a native binary.
- **Local Git mode** only treats root `spectra/` and `sdd/` as Spectra-owned when they carry a Spectra marker (`install.json` / `system/manifest.env`); ordinary company directories with those names no longer block install.
- **Migration** removes only Git exclude lines Spectra recorded in `install.json`; identical-looking user rules (`/docs/`, `/sdd/`, `/spectra/`) survive.
- **Generated release contract** no longer requires a `tests` gate that verify never evaluates (now `verify_work`), and generated text no longer says "verify v2" or "run spectra validate".

### Changed
- The source `scripts/` tree is synchronized with the packaged runtime scripts; the only intentional difference (`validate-repo.sh`) is documented and tested.
- Docs-vocabulary tests also cover the scripts READMEs.

## [3.0.9 development notes]

Consolidation and reliability release. No new product capabilities.

### Changed
- `.spectra/` is the single canonical project root; everything Spectra manages, including the local launcher (`.spectra/bin/spectra`), lives beneath it. The 3.0.8 `spectra/` layout and the pre-3.0 root `sdd/` layout are migration inputs only.
- Public commands are canonical internally: `context`, `task`, `eval`, `skills`, `adapters`, `diff`. The old forms (`context-pack`, `discuss-task`, `eval run`, `skills resolve`, `adapters generate`, `spec diff`, `admin <command>`) keep working through a compatibility layer and are no longer taught in help or docs.
- `spectra help` groups commands by workflow.
- `spectra verify` reports its shell-check stage as `verify-work` instead of `tests`; it never ran project tests. The report title is now `Spectra Verify`. Scoring is unchanged.
- Warnings and failures are written to stderr; normal output stays on stdout.
- `specs.js` and `context.js` are split into focused modules behind unchanged facades.

### Fixed
- Invalid CLI input fails early: unknown flags, string flags without a value or consuming another flag, and non-boolean values for boolean flags.
- `spectra update` reports success only after post-update validation passes and distinguishes migration failures from validation failures. Added `--yes` for non-interactive runs.
- Migration no longer risks partial moves: the legacy `spectra/` directory is removed last, the root-`sdd/` move happens last, half-finished migrations are reported instead of treated as complete, conflicting `spectra/` and `.spectra/` trees are left untouched with an actionable error, and a Spectra source repository is always refused.
- Test discovery is deterministic and CI runs the suite on Node 20 and 22. Version parity now also covers `init.sh`.

## Historical: pre-3.0 project layout notes

Undated notes from before this project moved to per-version headings below; content predates `v2.0.0`. This work was intended for `v3.0.0` because the generated project layout changes from root-level Spectra directories to the single `spectra/` boundary.

### Added
- Lite and Full installation profiles with Lite as the default.
- Simplified `help`, `check`, `status`, and `update` workflow commands.
- `spectra admin` grouping for Full-profile advanced commands while retaining compatibility aliases.
- Project schema and runtime version metadata.

### Changed
- Generated Spectra-owned content now lives beneath one `spectra/` directory.
- Local Git mode is now the default and excludes `/spectra/` through `.git/info/exclude`.
- Native and npm installations share the same profile assets and update behavior.

### Migration
- `spectra update` safely migrates legacy `.spectra/`, root `sdd/`, and known Spectra-generated documentation while preserving company files and working context.

## [v2.0.2] - 2026-07-06

### Fixed
- Made `spectra status` detect tests across brownfield repository layouts, including JVM `src/test/` trees.
- Counted only real traceability table rows instead of commented examples and status legends.
- Reported unstarted template state and uncommitted executable specs accurately.

### Changed
- Added brownfield health assertions to the native release smoke matrix.

## [v2.0.1] - 2026-06-12

### Added
- Native macOS/Linux install path through GitHub Release artifacts and `install.sh`.
- Repo-local `.spectra/bin/spectra` launcher for initialized and adopted projects.

### Changed
- Simplified the public CLI by removing the separate `spectra feature` scaffolding command.
- Aligned package, CLI, native, and runtime versions on `2.0.1`.

## [v2.0.0] - 2026-03-07

### Added
- Agent-independent canonical runtime under `sdd/system/`.
- New commands:
  - `scripts/generate-adapters.sh`
  - `scripts/map-codebase.sh`
  - `scripts/context-pack.sh`
  - `scripts/discuss-task.sh`
  - `scripts/verify-work.sh`
  - `scripts/quick.sh`
- New canonical manifests and memory-bank assets:
  - `sdd/system/manifest.env`
  - `sdd/system/runtime/context-packs.tsv`
  - `sdd/system/adapters/`
  - `sdd/memory-bank/core/implementation-brief.md`
  - `sdd/memory-bank/core/activeContext-archive.md`
  - `sdd/memory-bank/discovery/`

### Changed
- Migrated canonical runtime content from `sdd/.agent/` to `sdd/system/`.
- Refactored `scripts/init.sh` to support core-only install, `--adopt`, and `--agents`.
- Refactored `scripts/validate-repo.sh` to validate canonical/consumer repo modes and smoke-test adapter generation.
- Updated docs and CI to the v2 agent-independent model.

### Removed
- Legacy canonical path `sdd/.agent/`.
- Committed root adapter files from the Spectra source repo.
- Legacy root files `AGENT.md` and `.cursorrules`.

## [v1.0.2] - 2026-02-22

### Added
- Feature: Token-Efficient Intake Context
  - Split intake questions into phase/app-type packs under `sdd/system/rules/intake/questions/`.
  - Added runtime minimal loading manifest: `sdd/system/runtime/minimal.md`.
- Feature: Skill Graph Enforcement
  - Added canonical skill dependency map: `sdd/system/skills/dependency-map.tsv`.
  - Added skill run ledger: `sdd/memory-bank/core/skill-runs.md`.
  - Added resolver CLI: `scripts/resolve-skills.sh`.

### Changed
- Converted `sdd/system/rules/intake/01-questions.md` into a lightweight router.
- Updated `sdd/system/rules/intake/00-intake-flow.md` to load only relevant question packs.
- Updated adapter read-first contract to include `sdd/system/runtime/minimal.md`.
- Updated `sdd/system/rules/index.md` and `sdd/system/README.md` for runtime + pack discovery.

### Enforced
- Skill graph hard-fail checks in `scripts/check-policy.sh` for `app/*` ranges:
  - requires `skill-runs.md` updates
  - validates dependency order and required edges
- Repository validation in `scripts/validate-repo.sh` for:
  - skill `task_types` front matter
  - `dependency-map.tsv` integrity and known skill references

## [v1.0.1] - 2026-02-18

### Added
- Canonical intake decision governance with `Decision Log` and `Open Technical Questions` in `sdd/memory-bank/core/intake-state.md`.
- New core templates:
  - `sdd/memory-bank/core/invariants.md`
  - `sdd/memory-bank/core/review-gate.md`
- New governance rules:
  - `sdd/system/rules/intake/04-question-contract.md`
  - `sdd/system/rules/intake/05-question-catalog.md`
  - `sdd/system/rules/workflow/03-role-loop-gate.md`
  - `sdd/system/rules/workflow/04-escalation-policy.md`
- GitHub issue template for unresolved technical intake decisions:
  - `.github/ISSUE_TEMPLATE/intake-question.yml`

### Changed
- Updated intake, approval, lifecycle, sprint, and verification rules to enforce:
  - explicit technical decision confirmation
  - open-question blocking before approval
  - role-based quality gate sequencing
- Updated `scripts/init.sh` to prefill new intake-state sections.
- Updated docs and adapters to reflect decision loop, quality gate loop, escalation, and open-question lifecycle.
- Updated CI validation workflow messaging for range-aware policy checks.

### Enforced
- `scripts/check-policy.sh` now blocks when:
  - approval is `approved` while open technical questions exist
  - `app/` code exists while open technical questions remain
  - open technical questions have no valid issue reference
  - unresolved `critical`/`warning` findings exist in `review-gate.md`
  - `invariants.md` changes without `spec-history.md` or `arch/decisions.md` trail updates

## [v1.0.0] - 2026-02-17

### Added
- First stable Spectra release.
