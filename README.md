<p align="center">
  <img src="assets/logo.png" alt="Spectra Logo" width="180">
</p>

# Spectra

Persistent, governed project intelligence for interchangeable coding agents.

Coding agents forget between sessions. They also cannot tell which rules, requirements and decisions of your project are authoritative. Spectra keeps this knowledge in your repository. People and agents can both use it. It records what the project does, which rules and requirements govern it, which tests must verify them, and what the tests have verified.

**Agents execute. Spectra understands, resolves, governs, traces and verifies project knowledge.** An agent (or you) asks Spectra for the small part of the project knowledge that a task needs. The agent still reads and edits the real code. Later, the agent asks Spectra if the evidence supports the change.

Spectra is a local command-line tool. It is not an agent, a hosted service, a code generator or a replacement for your test runner and documentation. It owns `.spectra/`. Your application code, company documentation and repository layout stay yours. Every installation has the same features. There are no Lite or Full profiles.

## Get started

Install Spectra one time for each machine (or use `npx`). Then do `init` or `adopt` one time for each project.

| Your situation | Command | What it does |
| --- | --- | --- |
| New project | `spectra init .` | Creates the Spectra layer with generic starter files for you to fill in. |
| Existing project | `spectra adopt .` | Installs the same layer and records **repository evidence** (a deterministic index of modules, manifests and tests, plus discovery notes). It never runs your tests. It never invents business rules. What the code does is evidence, not business truth, until you review and promote it. |

### With Node.js and npm

```bash
cd my-project            # `git init` first for a new project
npx spectra-pack@latest init .      # or: adopt .
```

`npx` bootstraps Spectra without installing a global command. After setup, use the project-local launcher, `./.spectra/bin/spectra`. Check the version with `./.spectra/bin/spectra --version`.

### On macOS or Linux without Node.js

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
spectra --version
cd my-project
spectra adopt .          # or: init .
```

See [Native Install](docs/native-install.md) for permanent PATH setup and troubleshooting. The examples below use the project-local launcher. With a native install you can write `spectra` instead.

### Local or shared Git mode

The default **local** mode keeps `.spectra/` private. It adds `.spectra/` to `.git/info/exclude` and does not change `.gitignore`. Nothing that Spectra writes goes into your company repository unless you add it. Use **shared** mode when your team wants to review and commit the Spectra state. Derived caches and evidence stay uncommitted.

```bash
npx spectra-pack@latest adopt . --git-mode shared
```

### Agent adapters

Pass the agents you use. Spectra generates small guidance files that point back to `.spectra/`. The tools are `codex` (`AGENTS.md`), `claude` (`CLAUDE.md`), `copilot`, `cursor`, `windsurf` and `antigravity`.

```bash
npx spectra-pack@latest init . --agents codex,claude
```

The generated guidance tells an agent to do these steps:

1. Start with `spectra context`.
2. Use `spectra inspect` to look up the subject that it will change.
3. Run `spectra verify --gate` before it hands off the work.

Agents still read and edit the actual code. Spectra gives limited project knowledge that you can explain. It does not replace the code.

## Your first five minutes

```bash
./.spectra/bin/spectra onboard                        # capture project intent (interactive)
./.spectra/bin/spectra check                          # validate the Spectra layer
./.spectra/bin/spectra context --role planner --goal discover
./.spectra/bin/spectra inspect <id>                   # what governs a rule/requirement/module, and why
./.spectra/bin/spectra verify --explain <id>          # why a rule or requirement is verified, failed, stale or unverified
./.spectra/bin/spectra verify --gate review           # does the evidence let review proceed?
./.spectra/bin/spectra status                         # recent changes and the suggested next step
```

`inspect` accepts one stable ID of these types: a business rule (`RULE-ABC-001`), a requirement, scenario or invariant (`my-feature#FR-1`), a module (`node:module:packages/api`) or a test target. `verify --explain` accepts a rule, requirement, scenario or invariant ID. For a task, `context --route-task "<task>"` selects only the rules, requirements and modules that task touches. The [CLI reference](docs/cli-reference.md) lists every command and option.

## Core concepts

| Term | Meaning |
| --- | --- |
| Business rule (`RULE-…`) | A durable, evidence-backed statement about the product, stored per domain under `sdd/memory-bank/business/`. Uncertain claims stay in that domain's `unresolved.md`. |
| `FR` / `NFR` / `AC` / `INV` | A feature spec's functional requirements, non-functional requirements, acceptance scenarios and architectural invariants, with stable IDs such as `my-feature#FR-1`. |
| `Governs` | Optional rule metadata linking a rule to the requirement/scenario/invariant IDs it governs. |
| `verifiedBy` | Optional feature-spec metadata naming the test targets that verify a subject. |
| Repo Index | Deterministic, disposable evidence about the repository (modules, manifests, test targets): `cache/index/repo-index.json`. |
| Knowledge Map | Derived lookup of every addressable object. Rebuilt automatically from canonical files. |
| Test target | A test command from the Repo Index. `verify --test-target <id>` runs one and records the result. |
| Verification evidence | The recorded outcome of a test target, kept locally and never committed. |
| `verified` / `failed` / `stale` / `unverified` | The state of a subject. `verified`: all declared scopes passed. `failed`: one scope failed. `stale`: the code or declarations changed after the evidence. `unverified`: no scope has a result. |
| Review / release gate | `verify --gate review\|release`. It blocks only if a declared scope failed, is stale or has no result. Evidence has a scope. A passing test target supports the subjects that declare it. It does not prove that a requirement is true everywhere. |
| Project Intelligence | The combined capability: resolve, trace and verify project knowledge on demand through `context`, `inspect` and `verify`. |

Canonical knowledge (rules, feature specs, approvals) lives under `.spectra/sdd/`. Spectra derives the caches, the Repo Index, the Knowledge Map and the verification evidence in `.spectra/cache/`. It can always rebuild them.

## What Spectra adds to a project

Spectra keeps its runtime, project context, feature specifications and approvals under `.spectra/`. It does not use root-level `app/`, `docs/`, `sdd/`, `spectra/` or `.github/` as its data directories. If you request agent adapters, Spectra writes the small adapter files to the paths that each tool requires.

```text
acme/
├── .spectra/
│   ├── bin/spectra                    # project-local command
│   ├── cli/                           # Node fallback, when applicable
│   ├── sdd/                           # memory, specs, governance and runtime
│   ├── docs/spectra/                  # shipped Spectra usage guides
│   ├── docs/acme/                     # compatible plugin/skill artifacts
│   ├── cache/                         # derived: repo index, knowledge map, evidence
│   └── install.json                   # versions, names and ownership
├── CLAUDE.md                          # optional tool-required projection
└── .git/info/exclude                  # local mode adds /.spectra/
```

## A typical work session

```bash
# Load relevant context for the task
./.spectra/bin/spectra context --role implementer --goal implement --route-task "Describe the change"

# Record the work before implementation
./.spectra/bin/spectra task --item TASK-001 --task-type feature --goal "Describe the change"

# After the change: run the declared tests and see what they support
./.spectra/bin/spectra verify --test-target <test-target-id>
./.spectra/bin/spectra verify --gate review --changed
./.spectra/bin/spectra check
```

`spectra verify` without flags collects the release-readiness signals. It does not run the test command of your application. Use `verify --test-target` to run one test target. The [Workflow guide](docs/workflow.md) describes the staged approval and release process.

## Updating, migrating and uninstalling

These are three separate lifecycles:

- **`spectra update`** updates the *application* on a machine (a verified native install). It never reads or changes a project. Global npm users do `npm install -g spectra-pack@latest`. npx users do `npx spectra-pack@latest` to get a newer CLI.
- **`spectra migrate`** moves the layout and schema of one *project* to a newer version. It does this only when you ask. `migrate --check` shows the required steps and writes nothing. `migrate --yes` does the steps.
- **`spectra uninstall`** removes the verified native application files and leaves every project unchanged.

Derived caches (for example, the Knowledge Map) rebuild automatically after an update. They never need `migrate`. See [Getting Started](docs/getting-started.md) for both update paths.

## Common commands

| Command | Purpose | Project effect |
| --- | --- | --- |
| [`spectra init`](docs/cli-reference.md#init) | Set up a new project | Creates the Spectra layer. Local mode updates Git info/exclude. Optional adapters use tool-required paths. |
| [`spectra adopt`](docs/cli-reference.md#adopt) | Add Spectra to an existing project | Installs the layer and writes repository index/discovery evidence. |
| [`spectra onboard`](docs/cli-reference.md#onboard) | Capture project intent | Interactive runs write projectbrief.md. Non-interactive runs only report context. |
| [`spectra index`](docs/cli-reference.md#index) | Refresh repository evidence | Replaces cache/index/repo-index.json. `--check` does not write project files. |
| [`spectra context`](docs/cli-reference.md#context) | Load focused context | Reads canonical memory and refreshes derived cache/context summaries. |
| [`spectra route`](docs/cli-reference.md#route) | Select relevant modules/domains | Reads knowledge indexes. Does not write project files. |
| [`spectra inspect`](docs/cli-reference.md#inspect) | Explain one subject or the impact of changed files | Read-only. Never runs tests or touches approvals. |
| [`spectra task`](docs/cli-reference.md#task) | Record implementation intent | Replaces memory-bank/core/implementation-brief.md. |
| [`spectra check`](docs/cli-reference.md#check) | Validate the Spectra layer | Reports structure/policy/contract errors. No persistent project writes. |
| [`spectra eval`](docs/cli-reference.md#eval) / [`verify`](docs/cli-reference.md#verify) | Evaluate contracts / assess readiness and evidence | Writes eval reports. `verify` also refreshes the approval validity. `--test-target` records local evidence. `--explain` and `--gate` only read. Command-mode evals can run application commands. |
| [`spectra status`](docs/cli-reference.md#status) | Resume work | Recomputes approval validity and syncs approval status into project memory. |
| [`spectra doctor`](docs/cli-reference.md#doctor) | Inspect or repair health | Read-only by default. `--fix` refreshes safe generated files and keeps user-owned documents and adapters. |
| [`spectra update`](docs/cli-reference.md#update) | Update application software | Updates a verified native machine installation. It does not inspect or migrate projects. |
| [`spectra migrate`](docs/cli-reference.md#migrate) | Migrate one project | `--check` only reads. `--yes` applies the supported layout and schema steps to that project. |
| [`spectra uninstall`](docs/cli-reference.md#uninstall) | Remove the native application | Removes verified machine-owned native files and leaves every project unchanged. |
| [`spectra help`](docs/cli-reference.md#help) | Browse commands/options | Prints help. Does not write project files. |

Paths in this table are in `.spectra/`, unless the table gives a Git or adapter path. The advanced commands (`approve`, `eval`, `diff`, `quick`, `skills`, `adapters`) are in `spectra help advanced`. See the [complete command effects reference](docs/cli-reference.md#command-effects-at-a-glance) for all **24 public commands**, prerequisites, options, before/after file trees and workflow diagrams.

## Documentation

- [Overview](docs/overview.md) — the product in more depth
- [Quick Start](docs/quick-start.md) — bootstrap and first workflow
- [Getting Started](docs/getting-started.md) — setup choices and generated state
- [CLI Reference](docs/cli-reference.md) — every command and option
- [Workflow](docs/workflow.md) — approvals, evaluations, and release readiness
- [Testing and Verification](docs/testing.md) — what `check`, `eval`, and `verify` cover
- [Structure](docs/structure.md) — Spectra-owned files and directories
- [Native Install](docs/native-install.md) — macOS/Linux installation and troubleshooting
- [Business Context](docs/business-context.md) — durable business rules and context routing
- [Agent JSON contract](docs/agent-json-contract.md) — stable machine-readable output for agents
- [Website](https://yunusakin.github.io/spectra/) — project overview

## Contributing

```bash
npm ci
npm test
npm run check
```

The Spectra source has three packages: `packages/cli/`, `packages/core/`, and `packages/templates/`. The `sdd/` directory in this repository is the project knowledge of Spectra itself. The starter files for other projects come from `profiles/full/` and `packages/core/assets/runtime/`.

## Releases and license

- [GitHub Releases](https://github.com/yunusakin/spectra/releases) — native macOS/Linux downloads
- [spectra-pack on npm](https://www.npmjs.com/package/spectra-pack) — Node.js CLI
- MIT license — see [LICENSE](LICENSE)
