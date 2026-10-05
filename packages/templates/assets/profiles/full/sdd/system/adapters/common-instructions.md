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

## Project Intelligence

Ask Spectra for governed project knowledge instead of broad manual exploration when Spectra already holds the answer. It does not replace reading or inspecting the code you are changing. Everything in this section is read-only.

- Focused task context: `./.spectra/bin/spectra context --role <role> --goal <goal>` compiles the smallest useful context for a task.
- One known subject (a business rule, requirement, scenario, invariant, module or test-target ID): `./.spectra/bin/spectra inspect <id> --json`.
- What the current changes affect: `./.spectra/bin/spectra inspect --changed --json`.
- Why one subject is or is not verified: `./.spectra/bin/spectra verify --explain <id> --json`.
- Whether the current work may pass review: `./.spectra/bin/spectra verify --gate review --changed --json`.
- Release-wide readiness: `./.spectra/bin/spectra verify --gate release --json`.
- `--json` output carries a `contractVersion`. A failed query prints `{"ok": false, "error": {"code": ..., "message": ...}}` and exits with status 1.

## Plugin and Skill Output Location

- When an alternate output location is supported, create plugin/skill-generated project plans, designs, analyses, reports, and auxiliary files under `.spectra/docs/<project-name>/<plugin-or-skill-name>/`. Preserve useful subdirectories such as `specs/` and `plans/`.
- Use a safe single directory name; reject path separators, `..`, and absolute paths. Keep all outputs within the project's `.spectra/docs/` directory.
- Honor explicit user output paths and higher-priority instructions. Exclude application source code, required configuration or agent entrypoint files, plugin installation files, and application documentation intended for its own directory.
- Keep subsequent reads, links, and references consistent with the chosen location.
- If a plugin/skill requires a fixed path, use its supported configuration first. If safe redirection is unavailable, retain the required path and explain the exception to the user.
- Do not move or delete existing files without a user request, or overwrite Spectra's generated usage guides with plugin output.
- This is agent guidance; it does not intercept writes or enforce paths in external tools.
