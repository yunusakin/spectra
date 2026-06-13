# spectra-pack

`spectra-pack` installs the `spectra` CLI.

Spectra is a CLI-first operating system for AI-assisted product development. It bootstraps executable specs, staged approvals, eval contracts, telemetry contracts, semantic diff checks, role-aware context packs, and release-confidence verification.

## Install

```bash
npx spectra-pack@latest init my-product
cd my-product
spectra validate
spectra status
```

Brownfield adoption:

```bash
npx spectra-pack@latest adopt .
spectra validate
spectra diff semantic
```

Native no-Node install is documented in the repository: [Native Install](https://github.com/yunusakin/spectra/blob/main/docs/native-install.md).

## Commands

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
