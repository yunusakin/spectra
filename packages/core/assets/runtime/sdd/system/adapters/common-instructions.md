# Spectra Core Instructions

Use Spectra's canonical system files as the source of truth.

## Required Behavior

- Start from `spectra context --role <role> --goal <goal>` to determine what to read.
- For a normal development task, run `spectra route --task "<task description>"` before broad exploration; load only its selected module/domain context.
- Prefer summary-first packs and only escalate to raw markdown when ambiguity remains.
- Treat `sdd/memory-bank/business/` as canonical agent-neutral business knowledge. Persist only durable, evidence-backed business rules; keep uncertain or conflicting interpretations unresolved.
- Do not generate application code before explicit `implementation-approved`.
- Keep project state in `sdd/memory-bank/`.
- In consumer repositories, update `sdd/memory-bank/core/activeContext.md` and `sdd/memory-bank/core/progress.md` after significant work.
- Use `spectra verify` before marking work ready.
