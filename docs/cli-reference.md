# CLI Reference

This is the current public command surface for Spectra `2.0.2`.

## Install and Bootstrap

npm/npx, new project:

```bash
npx spectra-pack@latest init my-product
```

npm/npx, existing project:

```bash
cd existing-project
npx spectra-pack@latest adopt .
./.spectra/bin/spectra status
```

`npx` does not install a global command. Use `./.spectra/bin/spectra` after bootstrap.

Native macOS/Linux installation without Node/npm:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
spectra version
```

The remaining examples use `spectra`. Substitute `./.spectra/bin/spectra` when using only the repo-local launcher. See [Native Install](native-install.md) for supported platforms and troubleshooting.

## Setup Commands

```bash
spectra init [path]
spectra adopt [path]
```

`init` creates a new Spectra-managed project.

`adopt` adds Spectra to an existing codebase and creates brownfield adoption outputs.

## Workflow Commands

```bash
spectra context --role <role> --goal <goal>
spectra task --item <id> --task-type <type> --goal "<goal>"
spectra approve --stage <product-approved|technical-approved|implementation-approved|release-approved>
spectra validate [--base <sha> --head <sha>]
spectra eval <feature-id> --suite <smoke|release>
spectra verify [--scope <all|spec|app>] [--profile <standard|release>]
spectra status
```

## Utility Commands

```bash
spectra doctor
spectra quick --type <docs|rules|spec|ops> --task "<task>"
spectra skills --task-type <type> [--skills <csv>]
spectra adapters --agents <csv> --target <path>
spectra diff <init|update|semantic>
spectra version
spectra help
```

## Recommended Role and Goal Pairs

| Role | Goals |
| --- | --- |
| `planner` | `discover`, `decide` |
| `architect` | `decide`, `verify` |
| `implementer` | `implement` |
| `reviewer` | `verify` |
| `verifier` | `verify` |
| `release-manager` | `ship` |

## Recommended Daily Flow

```bash
spectra context --role planner --goal discover
spectra validate
spectra approve --stage implementation-approved
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra context --role implementer --goal implement
spectra eval my-product-core --suite smoke
spectra verify --profile release
```

## Notes

- There is no public `spectra feature` command. The core executable spec bundle is created by `init` or `adopt`.
- Prefer single-word commands in user-facing workflows.
- Use `spectra diff semantic` after meaningful spec changes to understand approval impact.
