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

Spectra keeps its runtime, project context, feature specifications, and approvals under `.spectra/`. It does not use root-level `app/`, `docs/`, `sdd/`, `spectra/`, or `.github/` as its data directories. If you request agent adapters, Spectra can generate small adapter files in the project root; they point back to `.spectra/` as the source of truth.

The default `local` Git mode keeps `.spectra/` private by recording it in `.git/info/exclude`; it does not edit `.gitignore`. Choose `shared` when your team wants to review and commit Spectra state:

```bash
npx spectra-pack@latest adopt . --git-mode shared
```

To generate agent-specific adapters during setup, pass the agents you use to `init` or `adopt`:

```bash
npx spectra-pack@latest init . --agents codex,claude
```

Install a Spectra application once for the machine or user account, then run `init` or `adopt` in each project. Updating or removing the application is separate from changing project state: `spectra update` updates a verified native application only, and `spectra uninstall` never changes a project. Global npm users update with `npm install -g spectra-pack@latest`; npx users invoke `npx spectra-pack@latest` when they want a newer CLI.

Migrate an older project explicitly:

```bash
./.spectra/bin/spectra migrate --check
./.spectra/bin/spectra migrate --yes
```

`--check` reports required steps without writing. See [Getting Started](docs/getting-started.md) for the separate application and project update paths.

An example after adopting `acme` with a Claude adapter:

```text
acme/
├── .spectra/
│   ├── bin/spectra                    # project-local command
│   ├── cli/                           # Node fallback, when applicable
│   ├── sdd/                           # memory, specs, governance and runtime
│   ├── docs/spectra/                  # shipped Spectra usage guides
│   ├── docs/acme/                     # compatible plugin/skill artifacts
│   ├── cache/index/repo-index.json    # disposable repository evidence
│   └── install.json                   # versions, names and ownership
├── CLAUDE.md                          # optional tool-required projection
└── .git/info/exclude                  # local mode adds /.spectra/
```

Other agents use their required root/tool paths. Adapters give compatible plugins output guidance; generating an adapter does not create plugin plans or move existing documents.

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

| Command | Purpose | Project effect |
| --- | --- | --- |
| [`spectra init`](docs/cli-reference.md#init) | Set up a new project | Creates the Spectra layer; local mode updates Git info/exclude; optional adapters use tool-required paths. |
| [`spectra adopt`](docs/cli-reference.md#adopt) | Add Spectra to an existing project | Installs the layer and writes repository index/discovery evidence. |
| [`spectra onboard`](docs/cli-reference.md#onboard) | Capture project intent | Interactive runs write projectbrief.md; non-interactive runs only report context. |
| [`spectra index`](docs/cli-reference.md#index) | Refresh repository evidence | Replaces cache/index/repo-index.json; --check does not write project files. |
| [`spectra context`](docs/cli-reference.md#context) | Load focused context | Reads canonical memory and refreshes derived cache/context summaries. |
| [`spectra route`](docs/cli-reference.md#route) | Select relevant modules/domains | Reads knowledge indexes; does not write project files. |
| [`spectra task`](docs/cli-reference.md#task) | Record implementation intent | Replaces memory-bank/core/implementation-brief.md. |
| [`spectra check`](docs/cli-reference.md#check) | Validate the Spectra layer | Reports structure/policy/contract errors; no persistent project writes. |
| [`spectra eval`](docs/cli-reference.md#eval) / [`verify`](docs/cli-reference.md#verify) | Evaluate contracts / assess readiness | Writes eval reports; verify also refreshes approval validity. Configured command-mode evals can execute application commands. |
| [`spectra status`](docs/cli-reference.md#status) | Resume work | Recomputes approval validity and syncs approval status into project memory. |
| [`spectra doctor`](docs/cli-reference.md#doctor) | Inspect or repair health | Read-only by default; --fix refreshes safe generated files and preserves user-owned documents/adapters. |
| [`spectra update`](docs/cli-reference.md#update) | Update application software | Updates a verified native machine installation; it does not inspect or migrate projects. Other distributions use their package manager or npx. |
| [`spectra migrate`](docs/cli-reference.md#migrate) | Migrate one project | `--check` is read-only; `--yes` explicitly applies supported layout/schema steps to that project. |
| [`spectra uninstall`](docs/cli-reference.md#uninstall) | Remove the native application | Removes verified machine-owned native files and leaves every project unchanged. |
| [`spectra help`](docs/cli-reference.md#help) | Browse commands/options | Prints help; does not write project files. |

Paths in this table are beneath `.spectra/` unless a Git or adapter path is stated. See the [complete command effects reference](docs/cli-reference.md#command-effects-at-a-glance) for all **23 public commands**, prerequisites, options, before/after file trees and workflow diagrams.

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

## Releases and license

- [GitHub Releases](https://github.com/yunusakin/spectra/releases) — native macOS/Linux downloads
- [spectra-pack on npm](https://www.npmjs.com/package/spectra-pack) — Node.js CLI
- MIT license — see [LICENSE](LICENSE)
