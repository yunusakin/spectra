# Quick Start

This is the fastest CLI-only path through Spectra v2.

## 1. Initialize a repo

```bash
npx spectra-pack@latest init my-product
cd my-product
```

Existing codebase:

```bash
npx spectra-pack@latest adopt .
```

No npm or Node available:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
spectra init my-product
cd my-product
```

`init` creates the first executable spec bundle automatically under `sdd/features/my-product-core/`.

## 2. Load planning context

```bash
spectra context --role planner --goal discover
```

## 3. Validate the current state

```bash
spectra validate
spectra status
```

## 4. Advance staged approvals

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
```

## 5. Create an implementation brief

```bash
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
```

## 6. Load implementation context

```bash
spectra context --role implementer --goal implement
```

## 7. Run eval and verify

```bash
spectra eval my-product-core --suite smoke
spectra verify --profile release
```

## 8. Mark release approval

```bash
spectra approve --stage release-approved
```

## Next

- [CLI Reference](cli-reference.md)
- [Native Install](native-install.md)
- [Workflow](workflow.md)
- [Minimal Feature Example](examples/minimal-feature/README.md)
