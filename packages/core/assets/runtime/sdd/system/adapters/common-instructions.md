# Spectra Core Instructions

Use Spectra's canonical system files as the source of truth.

## Required Behavior

- Start from `spectra context --role <role> --goal <goal>` to determine what to read.
- Prefer summary-first packs and only escalate to raw markdown when ambiguity remains.
- Do not generate application code before explicit `implementation-approved`.
- Keep project state in `sdd/memory-bank/`.
- In consumer repositories, update `sdd/memory-bank/core/activeContext.md` and `sdd/memory-bank/core/progress.md` after significant work.
- Use `spectra verify` before marking work ready.
