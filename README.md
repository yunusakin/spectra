<p align="center">
  <img src="assets/logo.png" alt="Spectra Logo" width="200">
</p>

# Spectra

Spectra is the CLI operating system for AI-assisted product development.

<p align="center">
  <a href="https://www.npmjs.com/package/spectra-pack">
    <img src="https://img.shields.io/npm/v/spectra-pack?color=cb3837&label=npm" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/spectra-pack">
    <img src="https://img.shields.io/npm/dm/spectra-pack" alt="npm downloads">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License">
  </a>
</p>

Spectra turns product intent into executable specs, staged approvals, implementation guidance, evals, and release confidence.

For teams building AI-assisted products that need more than prompt glue and coding copilots, Spectra gives one repo-native workflow for planning, approval, implementation, evals, and release readiness.

## Who Spectra Is For

Spectra is for teams that:

- build product features with AI agents or assistants
- want specs to be machine-readable, not just markdown notes
- need explicit approval gates before implementation and release
- care about evals, telemetry, and release confidence instead of "tests passed, probably fine"

If you only need a code generator, Spectra is too opinionated. If you need a working system for AI-assisted product delivery, this is the right layer.

## What Spectra Does

- defines features as executable YAML contracts plus a short brief
- enforces staged approvals before implementation and release
- loads token-aware context packs by role and goal
- tracks semantic spec diffs and approval impact
- runs eval and verify flows before shipping

## Get A First Win In 60 Seconds

```bash
npx spectra-pack@latest init my-product
cd my-product
spectra feature init demo-intake --name "Demo Intake Assistant" --type assistant
spectra validate
spectra status
```

What you get immediately:

- a working Spectra repo with CLI-first workflow
- a feature bundle under `sdd/features/demo-intake/`
- governance state under `sdd/governance/`
- a starting point for approvals, evals, and release verification

See also: [Quick Start](docs/quick-start.md) and [Getting Started](docs/getting-started.md)

Already have a repo?

```bash
npx spectra-pack@latest adopt .
```

## Minimal Executable Spec

`spectra feature init` creates a bundle like this:

```yaml
apiVersion: spectra/v2
kind: FeatureSpec
metadata:
  id: demo-intake
  name: Demo Intake Assistant
  version: 1.0.0
summary:
  problem: Inbound demo requests are incomplete and hard to route.
  outcome: Users can submit a complete demo request through an AI-guided intake flow.
requirements:
  functional:
    - id: FR-1
      statement: Collect the minimum required demo request fields.
      priority: must
acceptance:
  scenarios:
    - id: AC-1
      covers: [FR-1]
      given: A user starts a demo request
      when: The user answers the intake questions
      then: The required fields are captured
```

That feature bundle is then paired with:

- `ai-behavior-spec.yaml`
- `telemetry-contract.yaml`
- `technical-decisions.yaml`
- `evals/*`
- `release-checklist.md`

## The v2 Story

Spectra is built around one flow:

1. Define a feature as executable specs.
2. Validate structure, policy, and approval state.
3. Advance staged approvals before implementation.
4. Load token-aware context packs by role and goal.
5. Evaluate behavior and verify release confidence before shipping.

This is not a shell-script toolkit and not a markdown-only process template. The product surface is the `spectra` CLI.

## Golden Path

```bash
npx spectra-pack@latest init my-product
cd my-product

spectra feature init demo-intake --name "Demo Intake Assistant" --type assistant
spectra context --role planner --goal discover

spectra validate
spectra approve --stage product-approved
spectra approve --stage technical-approved

spectra task --item FEAT-001 --task-type feature --goal "Implement demo intake assistant"
spectra approve --stage implementation-approved

spectra context --role implementer --goal implement
spectra eval demo-intake --suite smoke
spectra verify --profile release
spectra approve --stage release-approved
```

## What Works Today

- `spectra init` and `spectra adopt`
- `spectra feature init` for new feature bundles
- staged approval state under `sdd/governance/`
- CLI-first `validate`, `status`, `eval`, and `verify`
- role-aware `spectra context`
- brownfield discovery outputs under `sdd/adoption/`

Spectra is already usable as a CLI product. The system is still evolving, but the public workflow is the CLI, not internal runtime scripts.

For command details and verification behavior, see [CLI Reference](docs/cli-reference.md) and [Testing](docs/testing.md).

## What Spectra Creates

```text
your-project/
├── .spectra/
├── app/
├── docs/
└── sdd/
    ├── features/
    │   └── <feature-id>/
    ├── governance/
    └── system/
```

Important directories:

- `sdd/features/`: executable feature bundles
- `sdd/governance/`: staged approval state and decision graph
- `sdd/system/`: runtime rules, prompts, adapters, and scaffolds

Optional supporting context may also exist under `sdd/memory-bank/`, but the v2 source of truth is the feature bundle plus governance YAML.

## Core Commands

Setup:

```bash
spectra init [path]
spectra adopt [path]
spectra feature init <feature-id>
```

Workflow:

```bash
spectra context --role <role> --goal <goal>
spectra task --item <id> --task-type <type> --goal "<goal>"
spectra approve --stage <stage>
spectra validate
spectra eval <feature-id> --suite smoke
spectra verify --profile release
spectra status
```

Utilities:

```bash
spectra adapters --agents codex,cursor --target .
spectra diff semantic
spectra doctor
spectra quick --type docs --task "refresh docs"
```

## Brownfield Adoption

Use `spectra adopt` when code already exists.

```bash
spectra adopt .
spectra validate
spectra diff semantic
spectra status
```

Adoption outputs live under:

- `sdd/adoption/current-state.summary.yaml`
- `sdd/adoption/gap-analysis.yaml`
- `sdd/adoption/review-queue.yaml`

Typical outcomes:

- `matches`: current code already fits the target spec
- `partial`: some behavior exists but coverage or contracts are incomplete
- `missing`: the target capability is not present
- `conflict`: current behavior contradicts the target spec
- `unknown`: manual review is still needed

See also: [Workflow](docs/workflow.md) and [Structure](docs/structure.md)

## Read Next

- [Overview](docs/overview.md)
- [Quick Start](docs/quick-start.md)
- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/cli-reference.md)
- [Structure](docs/structure.md)
- [Workflow](docs/workflow.md)
- [Testing](docs/testing.md)
- [Minimal Feature Example](docs/examples/minimal-feature/README.md)

## Local Development

If you are changing Spectra itself:

```bash
npm install
./node_modules/.bin/spectra validate
./node_modules/.bin/spectra verify --scope spec
```

## License

MIT. See [`LICENSE`](LICENSE).
