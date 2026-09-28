<p align="center">
  <img src="assets/logo.png" alt="Spectra Logo" width="180">
</p>

# Spectra

Spectra gives AI coding agents and people a shared, durable picture of a project: what it does, what has been decided, and what should happen next. It keeps that context alongside your repository so each new session can pick up where the last one left off.

Spectra owns `.spectra/`; your application code, company documentation, and repository layout remain yours. Every installation includes the same features. Choose the install method that fits your machine—there are no Lite/Full profiles to select.

## Get started

Use `init` for a new project and `adopt` for an existing one.

### With Node.js and npm

New project:

```bash
mkdir my-product && cd my-product
git init
npx spectra-pack@latest init .
```

Existing project:

```bash
cd existing-project
npx spectra-pack@latest adopt .
```

`npx` bootstraps Spectra without installing a global command. After setup, use the project-local launcher:

```bash
./.spectra/bin/spectra onboard
./.spectra/bin/spectra context --role planner --goal discover
./.spectra/bin/spectra check
./.spectra/bin/spectra status
```

`onboard` helps fill in project context. `context` gives an agent focused information to start planning; `check` validates the Spectra project layer; `status` shows recent changes and a suggested next step.

### On macOS or Linux without Node.js

Install the native command, then initialize or adopt a project:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
cd existing-project
spectra adopt . # use `spectra init .` for a new project
spectra onboard
spectra context --role planner --goal discover
```

See [Native Install](docs/native-install.md) for permanent PATH setup and troubleshooting.

## What Spectra adds to a project

Spectra keeps its runtime, context, feature specifications, approvals, and generated helpers under `.spectra/`. It does not take over root-level `app/`, `docs/`, `sdd/`, `spectra/`, or `.github/` directories.

The default `local` Git mode keeps `.spectra/` private by recording it in `.git/info/exclude`; it does not edit `.gitignore`. Choose `shared` when your team wants to review and commit Spectra state:

```bash
npx spectra-pack@latest adopt . --git-mode shared
```

To generate agent-specific adapters during setup, pass the agents you use:

```bash
npx spectra-pack@latest adopt . --agents codex,claude
```

Adapters point back to `.spectra/` as the source of truth. Use `spectra update` to update an existing installation while preserving project memory.

## A typical work session

```bash
# Load relevant planning context
./.spectra/bin/spectra context --role planner --goal discover

# Record the work before implementation
./.spectra/bin/spectra task --item TASK-001 --task-type feature --goal "Describe the change"

# Check Spectra's project state and resume guidance
./.spectra/bin/spectra check
./.spectra/bin/spectra status
```

Before shipping, run the feature's evaluation suite and `spectra verify`. Verify checks release readiness; run your application's own test command separately. The staged approval and release process is described in the [Workflow guide](docs/workflow.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `spectra init` | Set up a new project |
| `spectra adopt` | Add Spectra to an existing project |
| `spectra onboard` | Draft project context from your answers and repository index |
| `spectra context` | Load focused project context for an agent or person |
| `spectra task` | Record implementation intent |
| `spectra check` | Validate the Spectra project layer |
| `spectra status` | Resume work and see recent changes |
| `spectra update` | Update Spectra and migrate older layouts |
| `spectra help` | Browse commands and options |

## Documentation

- [Quick Start](docs/quick-start.md) — bootstrap and first workflow
- [Getting Started](docs/getting-started.md) — setup choices and generated state
- [CLI Reference](docs/cli-reference.md) — every command and option
- [Workflow](docs/workflow.md) — approvals, evaluations, and release readiness
- [Testing and Verification](docs/testing.md) — what `check`, `eval`, and `verify` cover
- [Structure](docs/structure.md) — Spectra-owned files and directories
- [Native Install](docs/native-install.md) — macOS/Linux installation and troubleshooting
- [Business Context](docs/business-context.md) — durable business rules and context routing
- [Website](https://yunusakin.github.io/spectra/) — project overview

## Contributing

```bash
npm ci
npm test
npm run check
```

Spectra's source is organized into `packages/cli/`, `packages/core/`, and `packages/templates/`.
