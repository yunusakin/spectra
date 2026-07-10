# CLI Reference

This is the current public command surface for Spectra `3.0.0`.

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

| Command | Use When | What It Does | Options / Modes |
| --- | --- | --- | --- |
| `spectra init [path] [--agents <csv>]` | starting a new repository | bootstraps a new Spectra-managed project | `--agents`: generate agent adapters during bootstrap |
| `spectra adopt [path] [--agents <csv>] [--git-mode <local\|shared>]` | adding Spectra to an existing repository | installs the Spectra operating layer and creates brownfield adoption outputs | `--git-mode local`: keep generated Spectra files local via Git exclude; `shared`: make the Spectra layer commit-ready; `--agents`: generate agent adapters |
| `spectra context --role <role> --goal <goal>` | before planning, architecture, implementation, or review work | loads the minimum role-aware and goal-aware context pack | common roles: `planner`, `architect`, `implementer`, `reviewer`, `verifier`, `release-manager`; common goals: `discover`, `decide`, `implement`, `verify`, `ship` |
| `spectra task --item <id> --task-type <type> --goal "<goal>"` | before implementation work starts | records implementation intent for a tracked item | `--task-type`: use the relevant work type for the item being implemented |
| `spectra approve --stage <stage>` | moving work through governance gates | advances staged approval state | stages: `product-approved`, `technical-approved`, `implementation-approved`, `release-approved` |
| `spectra validate [--base <sha> --head <sha>]` | after spec changes and before approvals | checks structure, policy, approval-state consistency, and spec completeness | `--base/--head`: validate a specific diff range |
| `spectra eval <feature-id> --suite <smoke\|release>` | after implementation work | runs feature eval suites | `--suite smoke`: faster confidence pass; `release`: stricter release evaluation |
| `spectra verify [--scope <all\|spec\|app>] [--profile <standard\|release>]` | before handoff or release approval | aggregates release-confidence checks | `--scope`: narrow verification target; `--profile release`: stricter release gate |
| `spectra status` | anytime | shows repository and approval health | no additional modes |
| `spectra doctor` | after bootstrap or adapter generation | checks local runtime health and agent readiness | reports each configured agent as `healthy`, `unhealthy`, or `not configured` |
| `spectra adapters --agents <csv> --target <path>` | enabling AI tool adapters | generates adapter files for selected agents | supported agents: `claude`, `cursor`, `windsurf`, `copilot`, `codex`, `antigravity` |
| `spectra diff <init\|update\|semantic>` | after meaningful spec updates | shows spec change impact | `semantic`: review approval-impacting changes |
| `spectra quick --type <docs\|rules\|spec\|ops> --task "<task>"` | small non-app tasks | runs the quick lane for focused helper work | `--type`: selects the quick lane domain |
| `spectra skills --task-type <type> [--skills <csv>]` | validating or resolving skill order | resolves the skill chain for a task type | `--skills`: override or pin explicit skills |
| `spectra version` / `spectra help` | confirming install state or command usage | prints version or command help | no additional modes |

```bash
spectra init [path] [--agents <csv>]
spectra adopt [path] [--agents <csv>] [--git-mode <local|shared>]
```

`init` creates a new Spectra-managed project and can generate agent adapters during bootstrap with `--agents`.

`adopt` adds Spectra to an existing codebase and creates brownfield adoption outputs.

When run interactively without `--git-mode`, `adopt` asks whether Spectra's generated operating files should be local or shared; `local` is the default. Local mode requires a Git worktree, leaves `.gitignore` unchanged, and writes exact generated paths to Git's repository-local exclude file. Project code created later under mixed directories such as `app/` and `docs/` remains visible to Git.

Use `--git-mode shared` when the generated Spectra layer should be reviewed and committed with the repository. Non-interactive calls without the flag retain the existing `shared` behavior for compatibility; scripts that require local-only files should pass `--git-mode local` explicitly.

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
