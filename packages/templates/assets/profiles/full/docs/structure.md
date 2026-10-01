# Structure

Spectra owns one directory in a consumer project: `.spectra/`.

## Consumer Repo Shape

After `spectra init .`, a project looks like this:

```text
your-project/
├── src/
├── tests/
├── package.json
└── .spectra/
    ├── bin/
    │   └── spectra
    ├── cli/
    ├── docs/
    ├── cache/
    ├── sdd/
    │   ├── features/
    │   ├── governance/
    │   ├── adoption/
    │   ├── memory-bank/
    │   └── system/
    ├── config.yaml
    └── install.json
```

## What Lives Where

### `.spectra/sdd/memory-bank/`

Long-lived project context includes active context, progress, project brief, implementation intent, discovery, review, and traceability material.

### `.spectra/sdd/system/`

Runtime assets include the manifest, rules, prompts, scaffolds, skills, and adapters.

### `.spectra/docs/`

Spectra's usage guides and examples live under `.spectra/docs/spectra/`. Compatible plugin and skill project artifacts use `.spectra/docs/<project-name>/<plugin-or-skill-name>/`. The project name is selected once from the existing brief or repository folder and stored as `docsProjectName` in `install.json`, so repository renames do not change document paths. The reserved name `spectra` becomes `spectra-project`.

Updates and `doctor --fix` refresh shipped guides while preserving extra project files. Existing documentation is not automatically moved. Agent guidance honors explicit user paths, higher-priority instructions, and tools requiring fixed paths; it does not enforce external tool writes. Memory, specs, governance, and cache retain their existing locations.

### `.spectra/cache/`

Generated context summaries and other disposable runtime data.

### `.spectra/config.yaml` and `.spectra/install.json`

Git mode, project schema, runtime version, launcher metadata, and installation history.

## Git Modes

`local` is the default. It records `/.spectra/` in the repository-local `.git/info/exclude` file without changing `.gitignore`.

`shared` leaves `.spectra/` visible and ready to commit with the project.

## Command-to-Structure Mapping

- `spectra init` and `spectra adopt` create the project runtime under `.spectra/`
- `spectra context` reads `.spectra/sdd/` and writes summaries to `.spectra/cache/`
- `spectra task` writes `.spectra/sdd/memory-bank/core/implementation-brief.md`
- `spectra status` summarizes current project and Spectra changes
- `spectra approve` updates `.spectra/sdd/governance/approval-state.yaml`

Spectra does not create root-level `spectra/`, `sdd/`, `docs/`, `app/`, or `.github/` directories.
