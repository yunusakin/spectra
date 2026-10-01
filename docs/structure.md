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

Spectra’s generated usage guides, workflow reference, and examples live under `.spectra/docs/spectra/`. Project-specific plugin/skill artifacts live under `.spectra/docs/<project-name>/`. It never creates a root-level `docs/` directory.

Generated agent adapters also direct compatible plugin and skill project artifacts (plans, designs, analyses, reports, and auxiliary files) to `.spectra/docs/<project-name>/<plugin-or-skill-name>/`, keeping their internal subdirectories and subsequent references consistent. Explicit user paths and higher-priority instructions take precedence. Application code, application documentation, required configuration/agent entrypoint files, and plugin installations retain their appropriate locations. Existing files are not automatically moved.

The project directory name is selected once from an existing project brief's name, falling back to the repository folder name, then normalized to lowercase letters, digits, and hyphens. The additive `docsProjectName` field in `install.json` preserves it across updates and repository renames. The reserved `spectra` name becomes `spectra-project` so it cannot collide with usage guides. Older installations acquire this field during refresh; old documentation paths are retained for compatibility while new guides are installed under `docs/spectra/`. Memory, feature specs, governance, and cache retain their existing canonical locations.

This is shared agent guidance, not filesystem enforcement: a tool requiring a fixed path uses supported configuration or keeps that path with an explained exception. Plugin/skill directory names must be safe single names, and outputs must stay within the project directory. Runtime updates and `doctor --fix` preserve extra files under `.spectra/docs/` while refreshing shipped guides; plugin artifacts should not overwrite those guides. The additive `docsGuidePaths` metadata field records which guides Spectra installed. Existing files colliding with a guide path are preserved with a warning and are not claimed as owned. Adapter generation with `--target` uses the target installation's stable name, falling back to its folder name. Doctor skips adapter repair when it would overwrite user-owned sibling files and reports their unhealthy state for manual repair.

For existing installations, update the runtime and regenerate Spectra-owned adapters with `spectra adapters --agents <csv>` to receive the guidance. User-owned adapter files remain protected. The E2E check `node --test packages/cli/test/plugin-output-guidance-e2e.test.js` retains generated adapter snapshots and prints their artifact path; it verifies instruction delivery and file preservation, not third-party plugin compliance.

### `.spectra/cache/`

Generated context summaries and disposable repo-index data.

### `.spectra/config.yaml` and `.spectra/install.json`

Git mode, project schema, runtime version, launcher metadata, and installation history.

## Git Modes

`local` is the default. It records `/.spectra/` in the repository-local `.git/info/exclude` file without changing `.gitignore`.

`shared` leaves `.spectra/` visible and ready to commit with the project.

## Command-to-Structure Mapping

- `spectra init` and `spectra adopt` create the project runtime under `.spectra/`
- `spectra index` writes `.spectra/cache/index/repo-index.json`
- `spectra context` reads `.spectra/sdd/` and writes summaries to `.spectra/cache/`
- `spectra task` writes `.spectra/sdd/memory-bank/core/implementation-brief.md`
- `spectra status` summarizes current project and Spectra changes
- `spectra approve` updates `.spectra/sdd/governance/approval-state.yaml`

Spectra does not create root-level `spectra/`, `sdd/`, `docs/`, `app/`, or `.github/` directories.
