# Quick Start

This is the shortest supported path through Spectra v2.

## 1. Bootstrap the Repository

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

YAML is canonical machine-readable state. Markdown provides supporting human context and should not duplicate YAML contracts.

## 3. Load Planning Context

```bash
spectra context --role planner --goal discover
```

## 4. Validate the Repository

```bash
spectra status
spectra check
```

Resolve validation errors and brownfield review items before approval.

## 5. Advance Approvals

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
```

Implementation should not begin before `implementation-approved`.

## 6. Capture and Implement the Work

```bash
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra context --role implementer --goal implement
```

## 7. Evaluate and Verify

```bash
spectra eval <feature-id> --suite smoke
spectra verify --profile release
```

## 8. Approve the Release

After release verification passes:

```bash
spectra approve --stage release-approved
```

## Next

- [Getting Started](getting-started.md)
- [CLI Reference](cli-reference.md)
- [Native Install](native-install.md)
- [Workflow](workflow.md)
- [Examples](examples/README.md)
