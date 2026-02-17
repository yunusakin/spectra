# Changelog

## Unreleased

### Added
- **Discovery Mode** (`sdd/.agent/rules/intake/03-discovery.md`): agent recommends technology, architecture, and infrastructure choices when user says "recommend" during intake. Includes per-question decision trees and full-stack package recommendations.
- **`scripts/init.sh`**: one-command project setup that copies all Spectra files and optionally pre-fills project basics via interactive wizard.
- **Quick Install** section in README with `curl` and local usage instructions.

### Changed
- Updated `00-intake-flow.md` with discovery trigger rule and announcement before technical questions.
- Updated all adapter files (AGENT.md, AGENTS.md, CLAUDE.md, .cursorrules) with discovery mode reference.
- Updated `docs/quick-start.md` and `docs/getting-started.md` to reflect init.sh and discovery mode.

### Fixed
- Logo reference in README (`logo-prism.png` → `logo.png`).
