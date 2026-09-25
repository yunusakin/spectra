# Runtime Minimal Context (Lite)

Paths in this file are relative to the consumer's `.spectra/` directory.

## Always Load
- `sdd/system/runtime/minimal.md`
- `sdd/memory-bank/core/activeContext.md`
- `sdd/memory-bank/core/progress.md`

## Task Mode
Load only the files relevant to the task from `sdd/system/runtime/context-packs.tsv`.
Use `spectra task` to prepare work, `spectra check` to check the installation, and `spectra status` to resume.
Full-profile intake, approval, and workflow rules are not installed in Lite.

## Guardrails
- Prefer delta updates over full rewrites of progress and context files.
- If uncertain which context to load, ask one targeted clarification.
