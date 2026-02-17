# Skill Usage

- After approval, select a skill before coding.
- Skills live under `sdd/.agent/skills/`.
- Use `sdd/.agent/skills/index.md` and `sdd/.agent/skills/USAGE.md` to choose the right skill.

## Selection Rule
- If the next change is ambiguous, ask the user which skill to apply (or propose the best match).
- If multiple areas are impacted (e.g., API + DB), apply a small sequence of skills (see `sdd/.agent/skills/dependency-graph.md`).

## Prompts
Reusable prompt templates live under `sdd/.agent/prompts/`.
- Use prompts as checklists/templates.
- Respect the approval gate: prompts that instruct writing code in `app/` must not be used before approval.
See `sdd/.agent/prompts/USAGE.md`.
