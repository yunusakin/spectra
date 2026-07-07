<p align="center">
  <img src="assets/logo.png" alt="Spectra Logo" width="180">
</p>

# Spectra

**Spectra is a CLI-first operating system for AI-assisted product development.**

It turns product intent into executable specs, staged approvals, role-aware agent context, behavior evals, telemetry contracts, and release-confidence checks.

<p align="center">
  <a href="https://www.npmjs.com/package/spectra-pack">
    <img src="https://img.shields.io/npm/v/spectra-pack?color=cb3837&label=npm" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/spectra-pack">
    <img src="https://img.shields.io/npm/dm/spectra-pack" alt="npm downloads">
  </a>
  <a href="https://github.com/yunusakin/spectra/releases">
    <img src="https://img.shields.io/github/v/release/yunusakin/spectra?label=release" alt="GitHub release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License">
  </a>
</p>

## Why Spectra Exists

AI-assisted development fails when product intent, model behavior, implementation work, evals, approvals, and release readiness live in disconnected places.

Spectra gives teams a repo-native workflow where:

- product requirements are captured as executable YAML contracts, not only Markdown notes
- AI behavior is specified explicitly through tool, fallback, escalation, and refusal rules
- staged approvals control when implementation and release work can proceed
- evals and telemetry contracts are part of the feature definition
- agents load only the context needed for their role and goal
- release confidence is checked through one CLI surface

Spectra is not a code generator. It is governance and operating infrastructure for teams building with AI agents.

## Install

Choose one distribution path. Both provide the same CLI and project structure.

### npm / npx

New project:

```bash
npx spectra-pack@latest init my-product
cd my-product
./.spectra/bin/spectra validate
./.spectra/bin/spectra status
```

Existing project:

```bash
cd existing-project
npx spectra-pack@latest adopt .
./.spectra/bin/spectra status
./.spectra/bin/spectra validate
```

`npx` bootstraps Spectra but does not install a global command. Use the generated repo-local launcher for subsequent commands.

### Native, without Node or npm

macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
spectra version
```

Initialize a new project:

```bash
spectra init my-product
cd my-product
```

Or adopt an existing project:

```bash
cd existing-project
spectra adopt .
```

The installer selects the correct GitHub Release artifact and verifies its SHA-256 checksum. See [Native Install](docs/native-install.md) for PATH setup, supported platforms, version pinning, and troubleshooting.

## What You Get

After `spectra init my-product`, Spectra creates a repo-local operating layer:

```text
my-product/
├── .spectra/
│   ├── bin/spectra
│   └── install.json
├── app/
├── docs/
└── sdd/
    ├── features/
    │   └── my-product-core/
    │       ├── feature.spec.yaml
    │       ├── ai-behavior-spec.yaml
    │       ├── telemetry-contract.yaml
    │       ├── technical-decisions.yaml
    │       ├── release-thresholds.yaml
    │       ├── brief.md
    │       ├── release-checklist.md
    │       └── evals/
    ├── governance/
    │   ├── approval-state.yaml
    │   └── decision-graph.yaml
    └── system/
```

The YAML files are the canonical machine-readable contracts. Markdown files provide human context and should not duplicate canonical state.

## Core Capabilities

| Capability | What Spectra Provides |
| --- | --- |
| Executable specs | Feature, AI behavior, telemetry, eval, technical decision, and release threshold contracts |
| Staged approvals | `draft -> product-approved -> technical-approved -> implementation-approved -> release-approved` |
| AI behavior governance | Tool contracts, allowed/disallowed actions, fallback rules, escalation, human review, and refusal policy |
| Eval system | Golden scenarios, regression suites, failure modes, and release thresholds |
| Telemetry contract | Requirement-to-event traceability, success/failure signals, alert conditions, dashboards, and ownership |
| Semantic diff | Meaning-based spec diff categories for approval invalidation and impact analysis |
| Brownfield adoption | Current-state discovery, gap analysis, review queue, and adoption classification |
| Context packs | Role-aware and goal-aware context loading for planner, architect, implementer, reviewer, verifier, and release manager |
| Verify v2 | Structure, policy, tests, evals, telemetry, and release readiness checks in one release-confidence pipeline |

## CLI Overview

The examples below use `spectra`. In an npm/npx-bootstrapped repository without a global install, replace it with `./.spectra/bin/spectra`.

Setup:

```bash
spectra init [path]
spectra adopt [path]
```

Daily workflow:

```bash
spectra context --role planner --goal discover
spectra validate
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra approve --stage implementation-approved
spectra context --role implementer --goal implement
spectra eval my-product-core --suite smoke
spectra verify --profile release
spectra approve --stage release-approved
```

Utilities:

```bash
spectra status
spectra doctor
spectra diff semantic
spectra adapters --agents codex,cursor --target .
spectra quick --type docs --task "refresh docs"
```

After generating agent adapters, run `spectra doctor` and confirm each configured agent reports `healthy`.

See [CLI Reference](docs/cli-reference.md) for the full command surface.

## Golden Path

1. Initialize or adopt a repo.
2. Review the generated core spec bundle under `sdd/features/<project>-core/`.
3. Load minimal planning context with `spectra context`.
4. Run `spectra validate`.
5. Move through staged approvals.
6. Create an implementation brief with `spectra task`.
7. Run evals with `spectra eval`.
8. Run release confidence checks with `spectra verify --profile release`.
9. Record release approval.

This keeps product decisions, AI behavior, implementation work, evals, telemetry, and release readiness traceable in the repository.

## Project Status

Current version: `2.0.2`

What works today:

- npm-distributed CLI package: [`spectra-pack`](https://www.npmjs.com/package/spectra-pack)
- `init` and `adopt` workflows
- executable v2 spec bundle generation
- staged approval state and decision graph
- validation, semantic diff, eval, verify, status, and role-aware `context` commands
- repo-local launcher under `.spectra/bin/spectra`
- native installer script and GitHub Release artifact workflow

Known limitation:

- Native install supports macOS and Linux on arm64 and x64. Windows native distribution is not available yet.
- Some internal runtime checks still call packaged shell scripts. The user-facing product surface is the `spectra` CLI.

## Documentation

- [Overview](docs/overview.md)
- [Quick Start](docs/quick-start.md)
- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/cli-reference.md)
- [Native Install](docs/native-install.md)
- [Repository Structure](docs/structure.md)
- [Workflow](docs/workflow.md)
- [Testing and Verification](docs/testing.md)
- [Examples](docs/examples/README.md)

## Local Development

```bash
npm install
npm run spectra -- --help
npm run validate
npm run verify
```

Useful checks before publishing:

```bash
node packages/cli/scripts/check-versions.mjs
npm_config_cache=/tmp/spectra-npm-cache npm pack --workspace packages/cli --dry-run --json
```

Native artifacts are built by `.github/workflows/native-release.yml` on version tags such as `v2.0.2`.

## License

MIT. See [LICENSE](LICENSE).
