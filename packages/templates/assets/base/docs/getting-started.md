# Getting Started

This guide explains the end-to-end Spectra v2 workflow in the order teams should use it.

## 1. Install and Initialize

New repo:

```bash
npx spectra-pack@latest init my-product
cd my-product
```

Brownfield repo:

```bash
npx spectra-pack@latest adopt .
```

Native no-Node path:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
spectra init my-product
cd my-product
```

The npm path is the primary supported distribution. The native path depends on GitHub Release artifacts.

## 2. Understand the Generated Bundle

`spectra init` and `spectra adopt` create the first executable spec bundle automatically.

For `my-product`, the generated bundle is:

- `sdd/features/my-product-core/feature.spec.yaml`
- `sdd/features/my-product-core/ai-behavior-spec.yaml`
- `sdd/features/my-product-core/telemetry-contract.yaml`
- `sdd/features/my-product-core/technical-decisions.yaml`
- `sdd/features/my-product-core/release-thresholds.yaml`
- `sdd/features/my-product-core/evals/*`
- `sdd/features/my-product-core/brief.md`
- `sdd/features/my-product-core/release-checklist.md`

YAML is canonical. Markdown is support context.

## 3. Plan with Minimum Context

```bash
spectra context --role planner --goal discover
```

Use context packs by role and goal instead of opening the whole repository.

Recommended role and goal pairs:

- `planner + discover`
- `planner + decide`
- `implementer + implement`
- `reviewer + verify`
- `verifier + verify`
- `release-manager + ship`

## 4. Validate Before Approval

```bash
spectra validate
spectra status
```

Validation should pass before any approval stage moves forward.

## 5. Advance Staged Approvals

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
```

Meaning:

- `product-approved`: product intent and scope are accepted
- `technical-approved`: architecture and technical boundaries are accepted
- `implementation-approved`: implementation can start
- `release-approved`: release signoff is complete

## 6. Create Implementation Intent

```bash
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
```

This writes the implementation brief used during execution and review.

## 7. Implement with Role-Aware Context

```bash
spectra context --role implementer --goal implement
```

Agents should read compact YAML contracts and generated summaries before long-form Markdown.

## 8. Evaluate Behavior

```bash
spectra eval my-product-core --suite smoke
```

This checks eval contracts, golden scenarios, regression suites, failure modes, and release thresholds.

## 9. Verify Release Confidence

```bash
spectra verify --profile release
```

Verify answers:

- is the repo structurally valid?
- is policy current?
- are tests, evals, and telemetry contracts present?
- is approval state valid?
- is release confidence high enough?

## 10. Mark Release Approval

```bash
spectra approve --stage release-approved
```

## Common Mistakes

- treating Spectra as a binary `approved / not approved` system
- duplicating canonical YAML state in Markdown
- skipping `spectra validate`
- starting implementation before `implementation-approved`
- treating `verify` like a plain test runner instead of a release-confidence gate

## Next

- [CLI Reference](cli-reference.md)
- [Structure](structure.md)
- [Workflow](workflow.md)
- [Native Install](native-install.md)
