# Spectra Core Instructions

Use Spectra's canonical system files as the source of truth.

## Required Behavior

- Run Spectra from the project root with `./.spectra/bin/spectra` (Windows: `.spectra\\bin\\spectra.cmd`).
- Start from `./.spectra/bin/spectra context --role <role> --goal <goal>` to determine what to read.
- Prefer summary-first packs and only escalate to raw markdown when ambiguity remains.
- Do not generate application code before explicit `implementation-approved`.
- Keep project state in `.spectra/sdd/memory-bank/`.
- In consumer repositories, update `.spectra/sdd/memory-bank/core/activeContext.md` and `.spectra/sdd/memory-bank/core/progress.md` after significant work.
- Treat root agent files such as `AGENTS.md` as generated projections of `.spectra/` state.
- Use `./.spectra/bin/spectra verify` before marking work ready.
