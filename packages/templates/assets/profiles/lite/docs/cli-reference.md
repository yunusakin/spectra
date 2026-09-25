# CLI Reference

This is the current public command surface for Spectra `3.1.1`.

## Install and Bootstrap

npm/npx, new project:

```bash
npx spectra-pack@latest init my-product
```

npm/npx, existing project:

```bash
cd existing-project
npx spectra-pack@latest adopt .
./.spectra/bin/spectra onboard
./.spectra/bin/spectra check
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

## Local Execution

The only executable Spectra generates locally is the launcher at
`.spectra/bin/spectra` (plus a `.spectra/bin/spectra.cmd` wrapper on
Windows), written by `init`/`adopt` and kept in place by `update`. It
resolves the installed native binary, falling back to the local Node
CLI, then a `spectra` on `PATH`. There is no separate per-command local
bin surface: every `spectra <command>` is available identically through
`spectra <command>` (installed) and `./.spectra/bin/spectra <command>`
(local), both operating on the same `.spectra/` project state. The
shell scripts under the runtime's `scripts/` directory (`validate-repo.sh`,
`verify-work.sh`, `check-policy.sh`, etc.) are internal implementation
detail invoked by these commands; they are not a separate user-facing
interface and were not part of the local bin surface before 3.0.9
either — moving the canonical root from `spectra/` to `.spectra/` did
not add, remove, or rename any local command.

## Setup Commands

| Command | Use When | What It Does | Options / Modes |
| --- | --- | --- | --- |
| `spectra init [path] [--profile <lite\|full>] [--git-mode <local\|shared>] [--agents <csv>]` | starting a new Git repository | bootstraps a Spectra-managed project under `.spectra/` | defaults: `lite`, `local`; `--agents` requires `--profile full` |
| `spectra adopt [path] [--profile <lite\|full>] [--git-mode <local\|shared>] [--agents <csv>]` | adding Spectra to an existing repository | installs the selected profile under `.spectra/` | `local`: private via Git exclude; `shared`: commit-ready; `--agents` requires `--profile full` |
| `spectra index [--check] [--explain] [--format <text\|json>]` | after bootstrap or manifest changes | builds or checks the deterministic repo index used by context, onboard, and verify | `--check` is read-only; `--explain` prints evidence |
| `spectra onboard [--force]` | after bootstrap when `projectbrief.md` is still a template | drafts the project brief from interactive answers and the repo index | non-interactive runs never rewrite the brief |
| `spectra route --task "<task>"` | before work that may touch business behavior | selects the smallest relevant module and business-domain context with deterministic match explanations | use `--format json`, `--domain`, or `--module` for explicit routing |
| `spectra context --role <role> --goal <goal>` | before planning, architecture, implementation, or review work | loads the minimum role-aware and goal-aware context pack | add `--route-task "<task>"` to compose business routing into the pack |
| `spectra knowledge <add\|promote\|resolve\|supersede\|deprecate>` | recording durable business knowledge | creates stable rule IDs and manages unresolved-to-active lifecycle | direct markdown edits remain valid; `spectra check` verifies integrity |
| `spectra task --item <id> --task-type <type> --goal "<goal>"` | before implementation work starts | records implementation intent for a tracked item | `--task-type`: use the relevant work type for the item being implemented |
| `spectra check [--base <sha> --head <sha>]` | after spec changes | runs the public validation entry point | `validate` remains a compatibility alias |
| `spectra doctor [--fix]` | checking local tool/runtime/adapter health | reports doctor checks; with `--fix`, repairs safe generated Spectra files and re-runs validation | does not rewrite business memory or application code |
| `spectra status` | resuming work | summarizes current project and Spectra changes | recommends the next action |
| `spectra update [--yes]` | checking or upgrading Spectra | checks the latest CLI version, asks once when changes are needed, refreshes runtime files, and migrates legacy layouts | reports `Spectra is already up to date.` when no work is needed; `--yes` skips the confirmation prompt |
| `spectra upgrade --profile <lite\|full>` | changing the installed profile | promotes Lite to Full while preserving existing project memory and updates runtime metadata | `--agents <csv>` optionally generates Full agent adapters; asks once for confirmation |
| `spectra help [command\|advanced]` | learning the CLI | shows the everyday workflow or Full commands | supports `--help` too |
| `spectra approve`, `eval`, `diff`, `adapters`, `skills`, `quick` | using Full features | advanced operations, each a top-level command | `spectra admin <command>` remains a compatibility alias |
| `spectra version` | confirming install state | prints the installed CLI version | no additional modes |

```bash
spectra init [path] [--profile <lite|full>] [--git-mode <local|shared>] [--agents <csv>]
spectra adopt [path] [--profile <lite|full>] [--git-mode <local|shared>] [--agents <csv>]
spectra index [--check] [--explain] [--format text|json]
spectra onboard [--force]
```

`init` creates a new Spectra-managed project under `.spectra/`. Lite is the default profile.

`adopt` adds Spectra to an existing codebase. Full additionally creates brownfield adoption outputs.

`index` writes `.spectra/cache/index/repo-index.json`, a disposable cache of detected modules, build/test targets, dependencies, runtimes, and evidence. `onboard` uses that cache only as technical evidence; it does not infer business intent.

`--agents <csv>` is valid only with `--profile full`; Lite keeps agent adapter files out of the repository root.

`local` is the default Git mode. It requires a Git worktree, leaves `.gitignore` unchanged, and writes `/.spectra/` to Git's repository-local exclude file. Project code and company documentation remain visible to Git.

Use `--git-mode shared` when the generated Spectra layer should be reviewed and committed with the repository.

Business-domain indexes may include explicit routing keywords:

```markdown
| Domain | Keywords | Rules | Unresolved | Related Modules |
| --- | --- | --- | --- | --- |
| customer-policy | eligibility,limit,approval | business/customer-policy/rules.md | business/customer-policy/unresolved.md | account-service |
```

`spectra route --format json` preserves `domains` and `modules` and adds `domainMatches` / `moduleMatches` entries that explain `matchedBy` and `matchedValue`.

`spectra knowledge add` defaults to unresolved. `--status active` requires `--verified`; `--verified` is invalid for unresolved rules.

## Workflow Commands

```bash
spectra context --role <role> --goal <goal>
spectra context --role <role> --goal <goal> --route-task "<task>"
spectra index [--check]
spectra onboard
spectra route --task "<task>" [--format refs|json]
spectra knowledge add --domain <domain> --title "<title>" --statement "<rule>" [--status unresolved|active] [--verified]
spectra knowledge promote --id <rule-id>
spectra knowledge resolve --id <rule-id>
spectra task --item <id> --task-type <type> --goal "<goal>"
spectra check [--base <sha> --head <sha>]
spectra status
spectra update
spectra upgrade --profile full
```

## Utility Commands

```bash
spectra doctor
spectra quick --type <docs|rules|spec|ops> --task "<task>"
spectra skills --task-type <type> [--skills <csv>]
spectra adapters --agents <csv> --target <path>
spectra diff <init|update|semantic>
spectra update
spectra version
spectra help
```

### Adapter files are generated projections

Canonical Spectra state lives only under `.spectra/`. Agent adapter files (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/**`, `.windsurf/rules/**`, `.agent/rules/**`) are generated projections of that state. They live at the paths each tool requires, are fully regenerable with `spectra adapters`, and should not be edited by hand.

For Full-profile agent-enabled repos, run `spectra doctor` after adapter generation. A healthy setup requires:

- each configured agent's adapter files exist
- each adapter file matches the Spectra-generated template
- any agent with a runtime prerequisite also has its command available on `PATH`

When those checks pass, `spectra doctor` reports each configured agent as `healthy`.

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
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra check
spectra status
```

## Notes

- There is no public `spectra feature` command. The core executable spec bundle is created by `init` or `adopt`.
- Prefer single-word commands in user-facing workflows.
- In Full, use `spectra diff semantic` after meaningful spec changes to understand approval impact.

## Versioning and Migration

Spectra uses one synchronized public version for npm, native binaries, the CLI, and packaged runtime assets. Project metadata keeps a separate schema version so compatible runtime upgrades do not imply a project-format break.

Run `spectra update` from a project at any time. Legacy layouts (the 3.0.8 `spectra/` directory, root `sdd/`, and known Spectra-generated root documentation) are migrated beneath `.spectra/`; unrelated company documentation is preserved. A declined confirmation leaves the project unchanged.
