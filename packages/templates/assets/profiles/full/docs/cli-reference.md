# CLI Reference

This is the current public command surface for Spectra `3.0.1`.

## Install and Bootstrap

npm/npx, new project:

```bash
npx spectra-pack@latest init my-product
```

npm/npx, existing project:

```bash
cd existing-project
npx spectra-pack@latest adopt .
./spectra/bin/spectra status
```

`npx` does not install a global command. Use `./spectra/bin/spectra` after bootstrap.

Native macOS/Linux installation without Node/npm:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
spectra version
```

The remaining examples use `spectra`. Substitute `./spectra/bin/spectra` when using only the repo-local launcher. See [Native Install](native-install.md) for supported platforms and troubleshooting.

## Setup Commands

| Command | Use When | What It Does | Options / Modes |
| --- | --- | --- | --- |
| `spectra init [path] [--profile <lite\|full>] [--git-mode <local\|shared>]` | starting a new Git repository | bootstraps a Spectra-managed project under `spectra/` | defaults: `lite`, `local` |
| `spectra adopt [path] [--profile <lite\|full>] [--git-mode <local\|shared>]` | adding Spectra to an existing repository | installs the selected profile under `spectra/` | `local`: private via Git exclude; `shared`: commit-ready |
| `spectra context --role <role> --goal <goal>` | before planning, architecture, implementation, or review work | loads the minimum role-aware and goal-aware context pack | common roles: `planner`, `architect`, `implementer`, `reviewer`, `verifier`, `release-manager`; common goals: `discover`, `decide`, `implement`, `verify`, `ship` |
| `spectra task --item <id> --task-type <type> --goal "<goal>"` | before implementation work starts | records implementation intent for a tracked item | `--task-type`: use the relevant work type for the item being implemented |
| `spectra check [--base <sha> --head <sha>]` | after spec changes | runs the public validation entry point | `validate` remains a compatibility alias |
| `spectra status` | resuming work | summarizes current project and Spectra changes | recommends the next action |
| `spectra update` | checking or upgrading Spectra | checks the latest CLI version, asks once when changes are needed, refreshes runtime files, and migrates legacy layouts | reports `Spectra is already up to date.` when no work is needed |
| `spectra help [command\|advanced]` | learning the CLI | shows the everyday workflow or Full commands | supports `--help` too |
| `spectra admin <approve\|eval\|diff\|adapters\|doctor\|skills\|quick>` | using Full features | groups advanced operations | top-level forms remain compatibility aliases |
| `spectra version` | confirming install state | prints the installed CLI version | no additional modes |

```bash
spectra init [path] [--profile <lite|full>] [--git-mode <local|shared>]
spectra adopt [path] [--profile <lite|full>] [--git-mode <local|shared>]
```

`init` creates a new Spectra-managed project under `spectra/`. Lite is the default profile.

`adopt` adds Spectra to an existing codebase. Full additionally creates brownfield adoption outputs.

`local` is the default Git mode. It requires a Git worktree, leaves `.gitignore` unchanged, and writes `/spectra/` to Git's repository-local exclude file. Project code and company documentation remain visible to Git.

Use `--git-mode shared` when the generated Spectra layer should be reviewed and committed with the repository.

## Workflow Commands

```bash
spectra context --role <role> --goal <goal>
spectra task --item <id> --task-type <type> --goal "<goal>"
spectra check [--base <sha> --head <sha>]
spectra status
spectra update
```

## Utility Commands

```bash
spectra admin doctor
spectra admin quick --type <docs|rules|spec|ops> --task "<task>"
spectra admin skills --task-type <type> [--skills <csv>]
spectra admin adapters --agents <csv> --target <path>
spectra admin diff <init|update|semantic>
spectra update
spectra version
spectra help
```

For Full-profile agent-enabled repos, run `spectra admin doctor` after adapter generation. A healthy setup requires:

- each configured agent's adapter files exist
- each adapter file matches the Spectra-generated template
- any agent with a runtime prerequisite also has its command available on `PATH`

When those checks pass, `spectra admin doctor` reports each configured agent as `healthy`.

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
spectra check
spectra admin approve --stage implementation-approved
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra context --role implementer --goal implement
spectra admin eval my-product-core --suite smoke
```

## Notes

- There is no public `spectra feature` command. The core executable spec bundle is created by `init` or `adopt`.
- Prefer single-word commands in user-facing workflows.
- In Full, use `spectra admin diff semantic` after meaningful spec changes to understand approval impact.

## Versioning and Migration

Spectra uses one synchronized public version for npm, native binaries, the CLI, and packaged runtime assets. Project metadata keeps a separate schema version so compatible runtime upgrades do not imply a project-format break.

Run `spectra update` from a project at any time. Legacy `.spectra/`, root `sdd/`, and known Spectra-generated root documentation are migrated beneath `spectra/`; unrelated company documentation is preserved. A declined confirmation leaves the project unchanged.
