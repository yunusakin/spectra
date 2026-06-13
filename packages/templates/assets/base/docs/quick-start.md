# Quick Start

This is the shortest supported path through Spectra v2.

## 1. Create or Adopt a Repo

New project:

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

The native path requires GitHub Release artifacts. If they are missing, use the npm path.

## 2. Inspect the Generated Spec Bundle

`init` and `adopt` create the first executable spec bundle automatically:

```text
sdd/features/my-product-core/
├── feature.spec.yaml
├── ai-behavior-spec.yaml
├── telemetry-contract.yaml
├── technical-decisions.yaml
├── release-thresholds.yaml
├── brief.md
├── release-checklist.md
└── evals/
```

## 3. Load Planning Context

```bash
spectra context --role planner --goal discover
```

## 4. Validate the Repo

```bash
spectra validate
spectra status
```

## 5. Advance Approvals

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
```

## 6. Create Implementation Intent

```bash
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
```

## 7. Load Implementation Context

```bash
spectra context --role implementer --goal implement
```

## 8. Run Eval and Verify

```bash
spectra eval my-product-core --suite smoke
spectra verify --profile release
```

## 9. Mark Release Approval

```bash
spectra approve --stage release-approved
```

## Next

- [Getting Started](getting-started.md)
- [CLI Reference](cli-reference.md)
- [Native Install](native-install.md)
- [Workflow](workflow.md)
- [Examples](examples/README.md)
