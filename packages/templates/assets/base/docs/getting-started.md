# Getting Started

This guide explains how to introduce Spectra to a new or existing repository and move from product intent to release confidence.

## 1. Choose a Distribution Path

Spectra has one CLI with two supported distribution paths.

### npm / npx

Create a new repository:

```bash
npx spectra-pack@latest init my-product
cd my-product
```

Adopt an existing repository:

```bash
cd existing-project
git switch -c chore/spectra-adoption
npx spectra-pack@latest adopt . --git-mode local
```

Choose `local` when Spectra is personal tooling for a company repository. Spectra records only the files it creates in `.git/info/exclude`; normal application changes remain commit candidates. Choose `shared` when the team intends to version the Spectra operating layer.

`npx` is a one-time bootstrap command. It does not make `spectra` globally available. Use the generated repo-local launcher:

```bash
./.spectra/bin/spectra status
./.spectra/bin/spectra validate
```

### Native installation without Node/npm

On macOS or Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
spectra version
```

Initialize a new repository:

```bash
spectra init my-product
cd my-product
```

Or adopt an existing repository:

```bash
cd existing-project
spectra adopt . --git-mode local
```

The native installer downloads the matching release artifact and verifies its SHA-256 checksum. See [Native Install](native-install.md) for permanent PATH configuration and troubleshooting.

The remaining examples use `spectra`. In an npm/npx-only repository, replace it with `./.spectra/bin/spectra`.

## 2. Review Bootstrap Changes

Run bootstrap on a clean branch and inspect the resulting diff before committing:

```bash
git status --short
git diff
```

Spectra adds a repo-local operating layer rather than replacing application code. Existing files are preserved; generated Spectra files should still be reviewed as normal source changes.

In `local` mode, `git status --ignored` shows the generated paths with `!!`, while plain `git status --short` continues to show only project changes. Do not use `git clean -fdx` if the local Spectra files must be retained.

## 3. Understand the Generated State

The first feature bundle is created under `sdd/features/<feature-id>/`:

- `feature.spec.yaml`: requirements and acceptance criteria
- `ai-behavior-spec.yaml`: model, tool, fallback, escalation, and refusal behavior
- `telemetry-contract.yaml`: requirement-to-event and metric traceability
- `technical-decisions.yaml`: architecture decisions and evidence
- `release-thresholds.yaml`: feature release gates
- `evals/`: golden scenarios, regressions, and failure modes
- `brief.md`: supporting human-readable product context
- `release-checklist.md`: human release procedure

Repository-level governance lives under `sdd/governance/`. YAML contracts are canonical; Markdown is supporting context.

## 4. Review Brownfield Analysis

`spectra adopt` maps the existing codebase and creates:

- `sdd/adoption/current-state.summary.yaml`
- `sdd/adoption/gap-analysis.yaml`
- `sdd/adoption/review-queue.yaml`

Treat `matches`, `partial`, `missing`, `conflict`, and `unknown` as review classifications, not automatic proof that implementation is correct. Resolve low-confidence and unknown items with human review, then update the executable specs to reflect the intended target state.

## 5. Load Minimum Planning Context

```bash
spectra context --role planner --goal discover
```

Recommended role and goal pairs:

| Role | Goals |
| --- | --- |
| `planner` | `discover`, `decide` |
| `architect` | `decide`, `verify` |
| `implementer` | `implement` |
| `reviewer` | `verify` |
| `verifier` | `verify` |
| `release-manager` | `ship` |

Context packs load compact contracts and summaries before long-form narrative files.

## 6. Validate Before Approval

```bash
spectra status
spectra validate
```

Validation should pass after bootstrap, after meaningful spec changes, and before every approval transition.

## 7. Advance Staged Approvals

```bash
spectra approve --stage product-approved
spectra approve --stage technical-approved
spectra approve --stage implementation-approved
```

- `product-approved`: product intent, scope, and acceptance criteria are accepted
- `technical-approved`: architecture and technical boundaries are accepted
- `implementation-approved`: implementation work may begin
- `release-approved`: verified release signoff is complete

## 8. Capture Implementation Intent

```bash
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra context --role implementer --goal implement
```

The task command records intended work for implementation and review traceability.

## 9. Evaluate Product Behavior

```bash
spectra eval <feature-id> --suite smoke
spectra eval <feature-id> --suite release
```

Eval suites exercise golden scenarios, regression cases, failure modes, refusal behavior, and release thresholds declared in the feature bundle.

## 10. Verify Release Confidence

```bash
spectra verify --profile release
```

Release verification aggregates structure, policy, tests, eval readiness, telemetry coverage, approval state, and release thresholds.

After verification passes:

```bash
spectra approve --stage release-approved
```

## 11. Handle Later Spec Changes

Do not rerun `adopt` for normal spec evolution. Inspect semantic impact and revalidate:

```bash
spectra diff semantic
spectra validate
spectra status
```

Re-approve any stage invalidated by the semantic diff.

## Common Mistakes

- assuming `npx` created a global `spectra` command
- implementing before `implementation-approved`
- treating generated brownfield analysis as a complete code audit
- duplicating canonical YAML state in Markdown
- skipping validation after spec changes
- treating `verify` as only a build/test command

## Next

- [CLI Reference](cli-reference.md)
- [Structure](structure.md)
- [Workflow](workflow.md)
- [Native Install](native-install.md)
