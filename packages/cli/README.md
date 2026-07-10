# spectra-pack

`spectra-pack` installs the `spectra` CLI.

Spectra is a CLI-first operating system for AI-assisted product development. It bootstraps executable specs, staged approvals, eval contracts, telemetry contracts, semantic diff checks, role-aware context packs, and release-confidence verification.

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

Spectra initializes a repository with:

- `spectra/bin/` repo-local launcher
- `spectra/install.json` profile, Git mode, CLI/runtime version, and schema metadata
- `spectra/docs/` generated Spectra reference material
- `spectra/sdd/` profile runtime and working context

Lite is the default. Full adds executable specs, governance, adoption, and advanced admin workflows. Local Git mode is the default and excludes `/spectra/` through `.git/info/exclude`; shared mode makes it commit-ready.

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
