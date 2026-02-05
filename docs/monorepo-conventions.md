# Monorepo Conventions

## Structure
- `app/` contains all application code.
- `docs/` contains project documentation.
- `scripts/` contains helper scripts.
- `sdd/` contains spec-driven artifacts and rules.

## Naming
- Use lowercase with hyphens for directories and files.
- Keep package and module names short and descriptive.

## Ownership
- Each top-level area should have a clear owner.
- Cross-cutting changes must update specs under `sdd/` when behavior or requirements change.

## Changes
- Spec changes land before or with code changes.
- Update `CHANGELOG.md` for user-visible changes.
