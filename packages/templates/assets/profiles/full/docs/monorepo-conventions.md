# Monorepo Conventions

## Structure
- Company code and documentation stay in the repository's existing structure.
- `spectra/` contains all Spectra-owned metadata, docs, SDD state, and runtime files.
- Full-profile executable specs and governance live under `spectra/sdd/`.

Spectra does not create or require a root `app/` directory. Full-profile approval rules govern implementation without imposing a company source layout.

## Naming
- Use lowercase with hyphens for directories and files.
- Keep package and module names short and descriptive.

## Ownership
- Each top-level area should have a clear owner.
- Cross-cutting changes must update specs under `spectra/sdd/` when behavior or requirements change.

## Changes
- Spec changes land before or with code changes.
- Update `CHANGELOG.md` for user-visible changes.
