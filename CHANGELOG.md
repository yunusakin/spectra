# Changelog

## [Unreleased]

### Planned
- (none)

## [v1.0.2] - 2026-02-22

### Added
- Feature: Token-Efficient Intake Context
  - Split intake questions into phase/app-type packs under `sdd/.agent/rules/intake/questions/`.
  - Added runtime minimal loading manifest: `sdd/.agent/runtime/minimal.md`.
- Feature: Skill Graph Enforcement
  - Added canonical skill dependency map: `sdd/.agent/skills/dependency-map.tsv`.
  - Added skill run ledger: `sdd/memory-bank/core/skill-runs.md`.
  - Added resolver CLI: `scripts/resolve-skills.sh`.

### Changed
- Converted `sdd/.agent/rules/intake/01-questions.md` into a lightweight router.
- Updated `sdd/.agent/rules/intake/00-intake-flow.md` to load only relevant question packs.
- Updated adapter read-first contract to include `sdd/.agent/runtime/minimal.md`.
- Updated `sdd/.agent/rules/index.md` and `sdd/.agent/README.md` for runtime + pack discovery.

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
  - `sdd/.agent/rules/intake/04-question-contract.md`
  - `sdd/.agent/rules/intake/05-question-catalog.md`
  - `sdd/.agent/rules/workflow/03-role-loop-gate.md`
  - `sdd/.agent/rules/workflow/04-escalation-policy.md`
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
