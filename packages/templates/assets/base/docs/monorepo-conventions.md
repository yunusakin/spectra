# Monorepo Conventions

## Structure
- `app/` contains all application code (generated after approval).
- `docs/` contains project documentation.
- `scripts/` contains helper scripts.
- `sdd/` contains spec-driven artifacts and rules.

**Note:** This repository includes `app/README.md` as a placeholder and structure guide. Agents must still wait for approval before generating any application code. If `app/` is missing, create it after approval before writing code.

## Naming
- Use lowercase with hyphens for directories and files.
- Keep package and module names short and descriptive.

## Ownership
- Each top-level area should have a clear owner.
- Cross-cutting changes must update specs under `sdd/` when behavior or requirements change.

## Changes
- Spec changes land before or with code changes.
- Update `CHANGELOG.md` for user-visible changes.
