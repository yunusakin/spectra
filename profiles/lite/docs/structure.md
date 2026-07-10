# Structure

Spectra owns one directory in a consumer project: `spectra/`.

## Consumer Repo Shape

After `spectra init .`, a Lite project looks like this:

```text
your-project/
├── src/
├── tests/
├── package.json
└── spectra/
    ├── bin/
    │   └── spectra
    ├── cli/
    ├── docs/
    ├── cache/
    ├── sdd/
    │   ├── memory-bank/
    │   └── system/
    ├── config.yaml
    └── install.json
```

Full adds these directories beneath `spectra/sdd/`:

```text
features/
governance/
adoption/
```

## What Lives Where

### `spectra/sdd/memory-bank/`

Long-lived project context. Lite uses active context, progress, project brief, and implementation brief; Full adds discovery, review, and traceability material.

### `spectra/sdd/system/`

Lite contains only the manifest and minimal runtime context. Full adds rules, prompts, scaffolds, skills, and adapters.

### `spectra/docs/`

Spectra’s generated usage guides, workflow reference, and examples. It never creates a root-level `docs/` directory.

### `spectra/cache/`

Generated context summaries and other disposable runtime data.

### `spectra/config.yaml` and `spectra/install.json`

The selected profile, Git mode, project schema, runtime version, launcher metadata, and installation history.

## Git Modes

`local` is the default. It records `/spectra/` in the repository-local `.git/info/exclude` file without changing `.gitignore`.

`shared` leaves `spectra/` visible and ready to commit with the project.

## Command-to-Structure Mapping

- `spectra init` and `spectra adopt` create the selected profile under `spectra/`
- `spectra context` reads `spectra/sdd/` and writes summaries to `spectra/cache/`
- `spectra task` writes `spectra/sdd/memory-bank/core/implementation-brief.md`
- `spectra status` summarizes current project and Spectra changes
- Full-profile `spectra admin approve` updates `spectra/sdd/governance/approval-state.yaml`

Spectra does not create root-level `.spectra/`, `sdd/`, `docs/`, `app/`, or `.github/` directories.
