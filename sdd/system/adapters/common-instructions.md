# Spectra Core Instructions

Use Spectra's canonical system files as the source of truth.

## Required Behavior

- Start from `spectra context --role <role> --goal <goal>` to determine what to read.
- Use route-first context for normal development: run `spectra route --task "<task description>"` before broad exploration and load only selected module/domain context.
- Prefer summary-first packs and only escalate to raw markdown when ambiguity remains.
- Treat `sdd/memory-bank/business/` as canonical agent-neutral business knowledge.
- Check existing domain knowledge before adding business rules.
- Unresolved is the default for new business claims.
- Require verified evidence before active business knowledge; use `spectra knowledge add --status active --verified` only for authoritative rules.
- Do not infer business truth from code alone; record ordinary code observations as unresolved.
- Avoid duplicate business rules by inspecting the relevant domain's existing rules first.
- Do not write a new business rule after every task; update memory only when reusable business knowledge was discovered.
- Do not generate application code before explicit `implementation-approved`.
- Keep project state in `sdd/memory-bank/`.
- In consumer repositories, update `sdd/memory-bank/core/activeContext.md` and `sdd/memory-bank/core/progress.md` after significant work.
- Use `spectra verify` before marking work ready.
