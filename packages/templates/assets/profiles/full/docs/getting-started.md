# Getting Started

This guide explains how to introduce Spectra without changing your application’s folder structure or forcing governance on every project.

Start with Lite. Move to Full only when a team needs formal specs, approvals, and release gates.

## 1. Choose a Distribution Path

Spectra has one CLI with two supported distribution paths.

### npm / npx

Create a new repository:

```bash
mkdir my-product && cd my-product
git init
npx spectra-pack@latest init .
```

Adopt an existing repository:

```bash
cd existing-project
git switch -c chore/spectra-adoption
npx spectra-pack@latest adopt . --git-mode local
```

Choose `local` when Spectra is personal tooling for a company repository. It adds only `/spectra/` to `.git/info/exclude`; your application changes remain normal commit candidates. Choose `shared` when the team intends to version the Spectra operating layer.

`npx` is a one-time bootstrap command. It does not make `spectra` globally available. Use the generated repo-local launcher:

```bash
./spectra/bin/spectra status
./spectra/bin/spectra check
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
mkdir my-product && cd my-product
git init
spectra init .
```

Or adopt an existing repository:

```bash
cd existing-project
spectra adopt . --git-mode local
```

The native installer downloads the matching release artifact and verifies its SHA-256 checksum. See [Native Install](native-install.md) for permanent PATH configuration and troubleshooting.

The remaining examples use `spectra`. In an npm/npx-only repository, replace it with `./spectra/bin/spectra`.

## 2. Review Bootstrap Changes

Run bootstrap on a clean branch and inspect the resulting diff before committing:

```bash
git status --short
git diff
```

Spectra adds a repo-local operating layer rather than replacing application code. Existing files are preserved; generated Spectra files should still be reviewed as normal source changes.

In `local` mode, `git status --ignored` shows the generated paths with `!!`, while plain `git status --short` continues to show only project changes. Do not use `git clean -fdx` if the local Spectra files must be retained.

## 3. Understand the Generated State

Lite creates an isolated SDD workspace under `spectra/`:

- `spectra/sdd/memory-bank/`: active context, progress, and implementation intent
- `spectra/sdd/system/`: minimal runtime context needed by Lite
- `spectra/docs/`: Spectra reference material
- `spectra/cache/`: disposable generated summaries

Full adds feature bundles, governance, evaluation contracts, and adoption analysis under `spectra/sdd/`. YAML contracts are canonical; Markdown is supporting context.

## 4. Use the Lite Daily Loop

```bash
spectra context --role planner --goal discover
spectra task --item TASK-001 --task-type feature --goal "Describe the intended change"
spectra check
spectra status
```

`status` is the command to run when you return to a project. `check` confirms the Spectra layer is healthy. Neither command requires a time window or a Full profile.

## 5. Review Brownfield Analysis (Full only)

Full `spectra adopt --profile full` maps the existing codebase and creates:

- `spectra/sdd/adoption/current-state.summary.yaml`
- `spectra/sdd/adoption/gap-analysis.yaml`
- `spectra/sdd/adoption/review-queue.yaml`

Treat `matches`, `partial`, `missing`, `conflict`, and `unknown` as review classifications, not automatic proof that implementation is correct. Resolve low-confidence and unknown items with human review, then update the executable specs to reflect the intended target state.

## 6. Load Minimum Planning Context

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

## 7. Validate Before Approval (Full only)

```bash
spectra status
spectra check
```

Validation should pass after bootstrap, after meaningful spec changes, and before every approval transition.

If you wire the same checks into GitHub Actions, prepare the Node environment first. Spectra's own `validate` workflow uses Node 22 and runs `npm ci` before calling CLI-based validation smoke checks.

## 8. Advance Staged Approvals (Full only)

```bash
spectra admin approve --stage product-approved
spectra admin approve --stage technical-approved
spectra admin approve --stage implementation-approved
```

- `product-approved`: product intent, scope, and acceptance criteria are accepted
- `technical-approved`: architecture and technical boundaries are accepted
- `implementation-approved`: implementation work may begin
- `release-approved`: verified release signoff is complete

## 9. Capture Implementation Intent

```bash
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra context --role implementer --goal implement
```

The task command records intended work for implementation and review traceability.

## 10. Evaluate Product Behavior (Full only)

```bash
spectra admin eval <feature-id> --suite smoke
spectra admin eval <feature-id> --suite release
```

Eval suites exercise golden scenarios, regression cases, failure modes, refusal behavior, and release thresholds declared in the feature bundle.

## 11. Verify Release Confidence (Full only)

```bash
spectra verify --profile release
```

Release verification aggregates structure, policy, tests, eval readiness, telemetry coverage, approval state, and release thresholds.

After verification passes:

```bash
spectra admin approve --stage release-approved
```

## 12. Handle Later Spec Changes

Do not rerun `adopt` for normal spec evolution. Inspect semantic impact and revalidate:

```bash
spectra admin diff semantic
spectra check
spectra status
```

Re-approve any stage invalidated by the semantic diff.

## Common Mistakes

- assuming `npx` created a global `spectra` command
- using Full approvals when Lite is enough
- implementing Full-profile work before `implementation-approved`
- treating generated brownfield analysis as a complete code audit
- duplicating canonical YAML state in Markdown
- skipping validation after spec changes
- treating `verify` as only a build/test command

## Next

- [CLI Reference](cli-reference.md)
- [Structure](structure.md)
- [Workflow](workflow.md)
- [Native Install](native-install.md)
