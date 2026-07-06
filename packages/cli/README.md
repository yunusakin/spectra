# spectra-pack

`spectra-pack` installs the `spectra` CLI.

Spectra is a CLI-first operating system for AI-assisted product development. It bootstraps executable specs, staged approvals, eval contracts, telemetry contracts, semantic diff checks, role-aware context packs, and release-confidence verification.

## Install

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

`npx` bootstraps the repository but does not create a global command. Continue with `./.spectra/bin/spectra`, or install the standalone native binary for a global `spectra` command.

Node/npm-free macOS and Linux installation is documented in [Native Install](https://github.com/yunusakin/spectra/blob/main/docs/native-install.md).

## Commands

The examples below use `spectra`. Replace it with `./.spectra/bin/spectra` when using only the repo-local launcher.

Setup:

```bash
spectra init [path]
spectra adopt [path]
```

Workflow:

```bash
spectra context --role planner --goal discover
spectra task --item TASK-001 --task-type feature --goal "Describe intended change"
spectra approve --stage implementation-approved
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

## What It Installs

Spectra initializes a repository with:

- `.spectra/` install metadata and repo-local launcher
- `sdd/features/` executable spec bundles created during `init` or `adopt`
- `sdd/governance/` approval and decision graph state
- `sdd/system/` runtime rules, prompts, adapters, and scaffolds
- `sdd/memory-bank/` optional human-readable working context

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
