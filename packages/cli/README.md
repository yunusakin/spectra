# spectra-pack

`spectra-pack` installs the `spectra` CLI.

Spectra is a CLI-first operating system for AI-assisted product development. It bootstraps project-local context, business knowledge, executable specs, staged approvals, eval contracts, telemetry contracts, semantic diff checks, role-aware context packs, and release-confidence verification.

## Install

New project:

```bash
npx spectra-pack@latest init my-product
cd my-product
./spectra/bin/spectra check
./spectra/bin/spectra status
```

Existing project:

```bash
cd existing-project
npx spectra-pack@latest adopt .
./spectra/bin/spectra status
./spectra/bin/spectra check
```

`npx` bootstraps the repository but does not create a global command. Continue with `./spectra/bin/spectra`, or install the standalone native binary for a global `spectra` command.

Node/npm-free macOS and Linux installation is documented in [Native Install](https://github.com/yunusakin/spectra/blob/main/docs/native-install.md).

## Commands

The examples below use `spectra`. Replace it with `./spectra/bin/spectra` when using only the repo-local launcher.

Setup:

```bash
spectra init [path] [--profile <lite|full>] [--git-mode <local|shared>]
spectra adopt [path] [--profile <lite|full>] [--git-mode <local|shared>]
```

Workflow:

```bash
spectra context --role planner --goal discover
spectra task --item TASK-001 --task-type feature --goal "Describe intended change"
spectra check
spectra status
spectra update
```

Utilities:

```bash
spectra help
spectra help advanced
spectra admin doctor
spectra admin diff semantic
```

## What It Installs

Spectra initializes a repository by creating one Spectra-owned directory:

- `spectra/bin/` repo-local launcher
- `spectra/install.json` profile, Git mode, CLI/runtime version, and schema metadata
- `spectra/docs/` generated Spectra reference material
- `spectra/sdd/` profile runtime, working context, and business memory

Spectra-owned files should not be installed into root-level `docs/`, `sdd/`, `.spectra/`, `.github/`, or `app/`. Legacy shell scripts may still exist in the repository for compatibility and runtime maintenance, but the supported consumer setup path is this CLI.

Lite is the default. Full adds executable specs, governance, adoption, agent adapters, and advanced admin workflows. Local Git mode is the default and excludes `/spectra/` through `.git/info/exclude`; shared mode makes it commit-ready.

## Business Context

Business knowledge lives under `spectra/sdd/memory-bank/business/` and is indexed by domain. Context routing uses domain names, related modules, and explicit configured keywords to include only task-relevant business rules and unresolved questions, which keeps prompts smaller while preserving durable project knowledge.

```markdown
| Domain | Keywords | Rules | Unresolved | Related Modules |
| --- | --- | --- | --- | --- |
| customer-policy | eligibility,limit,approval | business/customer-policy/rules.md | business/customer-policy/unresolved.md | account-service |
```

`spectra route --format json` explains each match with fields such as `domainMatches` and `moduleMatches`.

New business claims default to unresolved. Use `--status active --verified` only when evidence is authoritative; code behavior alone should normally be recorded as unresolved.

Agent adapters such as `AGENTS.md` or `CLAUDE.md` are generated only when requested with a Full profile. They point agents back to the same Spectra source of truth instead of duplicating project knowledge per agent.

## Documentation

- [Repository README](https://github.com/yunusakin/spectra#readme)
- [Quick Start](https://github.com/yunusakin/spectra/blob/main/docs/quick-start.md)
- [Getting Started](https://github.com/yunusakin/spectra/blob/main/docs/getting-started.md)
- [CLI Reference](https://github.com/yunusakin/spectra/blob/main/docs/cli-reference.md)
- [Native Install](https://github.com/yunusakin/spectra/blob/main/docs/native-install.md)
- [Structure](https://github.com/yunusakin/spectra/blob/main/docs/structure.md)
- [Workflow](https://github.com/yunusakin/spectra/blob/main/docs/workflow.md)
- [Issues](https://github.com/yunusakin/spectra/issues)

## License

MIT
