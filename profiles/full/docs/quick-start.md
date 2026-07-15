# Quick Start

This is the fastest way to start using Spectra. It defaults to **Lite**: private, project-local working context with no approval workflow to manage.

Choose **Full** only when you need executable feature specs, staged approvals, evaluations, or shared team governance.

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
```

`npx` does not install a global command. Use the generated launcher after bootstrap:

```bash
./spectra/bin/spectra version
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
```

The remaining examples use `spectra`. If you used only `npx`, replace `spectra` with `./spectra/bin/spectra`.

To promote an existing Lite project to Full:

```bash
spectra upgrade --profile full
```

Use `spectra update` for CLI/runtime updates. Use `spectra upgrade` for profile changes.

## 2. Review What Spectra Created

Lite keeps its SDD system, memory bank, docs, launcher, and metadata inside `spectra/`:

```text
spectra/
├── docs/
├── sdd/memory-bank/
├── sdd/system/
├── bin/spectra
├── config.yaml
└── install.json
```

Full additionally creates feature bundles, governance, and adoption analysis:

```text
spectra/sdd/features/
spectra/sdd/governance/
spectra/sdd/adoption/
```

Everything Spectra owns is inside `spectra/`. Your code, tests, existing documentation, and normal repository layout stay where they are.

By default, local Git mode keeps `spectra/` out of your company repository through `.git/info/exclude`. Use `--git-mode shared` only when the team wants to commit Spectra files.

## 3. Start the Daily Loop

```bash
spectra context --role planner --goal discover
spectra task --item TASK-001 --task-type feature --goal "Describe the change"
spectra check
spectra status
```

Use `status` when returning after a break. It shows current project changes and the next suggested action. Use `check` before or after meaningful work.

## 4. Use Full Only When You Need Governance

Start Full explicitly:

```bash
spectra init . --profile full
```

Full adds `spectra/sdd/features/`, `governance/`, and `adoption/`. Its advanced operations live under `spectra admin`:

```bash
spectra admin approve --stage product-approved
spectra admin approve --stage technical-approved
spectra admin approve --stage implementation-approved
spectra admin eval <feature-id> --suite smoke
spectra verify --profile release
```

Top-level `approve`, `eval`, and similar advanced commands remain available for compatibility, but new documentation uses `spectra admin`.

## Next

- [Getting Started](getting-started.md)
- [CLI Reference](cli-reference.md)
- [Native Install](native-install.md)
- [Workflow](workflow.md)
- [Examples](examples/README.md)
