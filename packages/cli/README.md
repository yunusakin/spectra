# spectra-pack

Spectra is a CLI-first operating system for AI-assisted product development.

[![npm version](https://img.shields.io/npm/v/spectra-pack?color=cb3837&label=npm)](https://www.npmjs.com/package/spectra-pack)
[![npm downloads](https://img.shields.io/npm/dm/spectra-pack)](https://www.npmjs.com/package/spectra-pack)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/yunusakin/spectra/blob/main/LICENSE)

This package installs the `spectra` CLI and includes the runtime and template assets needed to bootstrap or adopt a repository.

## Install With npx

```bash
npx spectra-pack@latest init /path/to/project
cd /path/to/project
spectra validate
spectra status
```

Brownfield adoption:

```bash
npx spectra-pack@latest adopt /path/to/project
```

## Install and Run

After initialization, use the installed CLI command inside the target repository:

```bash
spectra validate
spectra status
spectra verify
```

## Core Commands

Setup:

```bash
spectra init [path]
spectra adopt [path]
```

Workflow:

```bash
spectra context --role planner --goal discover
spectra task --item TASK-001 --task-type bugfix --goal "Describe intended change"
spectra approve --stage implementation-approved
spectra validate
spectra verify
spectra eval spectra-core --suite smoke
```

Utilities:

```bash
spectra adapters --agents codex,cursor --target .
spectra diff semantic
spectra doctor
```

## What It Installs

Spectra initializes a repository with:

- `.spectra/` install metadata and cache
- `sdd/features/` executable spec bundles
- `sdd/governance/` approval and decision graph state
- `sdd/memory-bank/` human-readable working context
- `sdd/system/` runtime rules, prompts, adapters, and scaffolds

## Documentation

- [Repository README](https://github.com/yunusakin/spectra#readme)
- [Quick Start](https://github.com/yunusakin/spectra/blob/main/docs/quick-start.md)
- [Structure](https://github.com/yunusakin/spectra/blob/main/docs/structure.md)
- [Workflow](https://github.com/yunusakin/spectra/blob/main/docs/workflow.md)
- [Issues](https://github.com/yunusakin/spectra/issues)

## License

MIT
