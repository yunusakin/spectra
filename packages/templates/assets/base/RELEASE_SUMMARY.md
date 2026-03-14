# Release Summary

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
