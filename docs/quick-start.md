# Quick Start

This is the fastest way to start using Spectra. Every installation includes executable feature specs, staged approvals, evaluations, and brownfield analysis.

## 1. Bootstrap the Repository

Choose the path that matches your project:

- New project: use `init`.
- Existing project: use `adopt`.
- No Node/npm: use the native installation.

Choose one distribution path.

### With npm / npx

New project:

```bash
mkdir my-product && cd my-product
git init
npx spectra-pack@latest init .
```

Existing project:

```bash
cd existing-project
npx spectra-pack@latest adopt .
./.spectra/bin/spectra onboard
./.spectra/bin/spectra check
./.spectra/bin/spectra status
```

`npx` does not install a global command. Use the generated launcher after bootstrap:

```bash
./.spectra/bin/spectra version
```

### Without Node or npm

Install the standalone macOS/Linux binary:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
spectra version
```

Create a new repository:

```bash
mkdir my-product && cd my-product
git init
spectra init .
```

Or adopt an existing repository:

```bash
cd existing-project
spectra adopt .
spectra onboard
spectra check
spectra status
```

The remaining examples use `spectra`. If you used only `npx`, replace `spectra` with `./.spectra/bin/spectra`.

Use `spectra update` for CLI and runtime updates. Existing project memory is preserved.

## 2. Review What Spectra Created

Spectra keeps its runtime, memory bank, docs, launcher, and metadata inside `.spectra/`:

```text
.spectra/
├── docs/
├── cache/
├── sdd/memory-bank/
├── sdd/system/
├── sdd/features/
├── sdd/governance/
├── sdd/adoption/
├── bin/spectra
├── config.yaml
└── install.json
```

Everything Spectra owns is inside `.spectra/`. Your code, tests, existing documentation, and normal repository layout stay where they are.

By default, local Git mode keeps `.spectra/` out of your company repository through `.git/info/exclude`. Use `--git-mode shared` only when the team wants to commit Spectra files.

For existing projects, `adopt` writes an initial repo index when possible. Run `spectra onboard` while `projectbrief.md` is still a template, and run `spectra index` again after manifest changes or if adoption reports that indexing failed.

## 3. Start the Daily Loop

```bash
spectra context --role planner --goal discover
spectra task --item TASK-001 --task-type feature --goal "Describe the change"
spectra check
spectra status
```

Use `status` when returning after a break. It shows current project changes and the next suggested action. Use `check` before or after meaningful work.

## 4. Use Governance and Evaluations

Advanced operations are top-level commands:

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
spectra eval <feature-id> --suite smoke
spectra verify --profile release
```

`spectra admin <command>` still works as a compatibility alias for these commands, but the top-level forms above are the documented ones.

## Next

- [Getting Started](getting-started.md)
- [CLI Reference](cli-reference.md)
- [Native Install](native-install.md)
- [Workflow](workflow.md)
- [Examples](examples/README.md)
