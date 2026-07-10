# Multi-Project Setup

This repository is designed to be a stable Spectra workspace for a single project. If you need to manage multiple projects, use one of the patterns below.

## Recommended: One Repo Per Project

- Create a new repo per project based on this Spectra template.
- Treat the repo root as the agent working directory.
- Keep each project’s Spectra state under its own `spectra/` directory and leave code in the project’s normal source layout.

This keeps profile, Git policy, status, and approval state isolated per project.

## Option: Monorepo With One Spectra Workspace Per Project Folder

If you need a monorepo, keep each project self-contained inside its own folder and run the agent from that folder.

Example structure:

```text
projects/
  orders/
    spectra/
    src/
  billing/
    spectra/
    src/
shared/
  libs/
```

Guidelines:
- Do not share `spectra/sdd/governance/` between projects. Each project should own its own spec and approval state.
- Keep `spectra/sdd/memory-bank/` project-local too.
- Shared code can remain in the monorepo’s normal shared-package layout.

See also: `docs/monorepo-conventions.md`.

## Option: Single Spectra Workspace For Multiple Services (Not Recommended)

If you insist on using one Spectra workspace to drive multiple services, be explicit:
- maintain separate requirement sections per service
- track decisions per service in the decision graph and supporting architecture logs
- keep the approval gate clear (who approves what, and when)

This tends to increase coordination cost and makes validation and re-approval more ambiguous.
