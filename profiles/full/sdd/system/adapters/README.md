# Adapter Templates

This directory stores canonical fragments used to generate agent-specific instruction files.

Generated outputs are not source of truth. They are derived artifacts for repositories that use Spectra.

## Canonical Inputs

- `common-instructions.md`
- `ignore-patterns.txt`
- `../runtime/context-packs.tsv`

## Generated Targets

- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.cursor/rules/*.mdc`
- `.windsurf/rules/*.md`
- `.agent/rules/*.md`
