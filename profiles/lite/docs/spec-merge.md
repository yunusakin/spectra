# Spec Merge Strategies

In Spectra v2, the canonical merge target is the feature bundle, not the old memory-bank-first flow.

## Source Of Truth

Prefer merging changes under:

- `sdd/features/<feature-id>/`
- `sdd/governance/approval-state.yaml`
- `sdd/governance/decision-graph.yaml`

Use Markdown only as supporting narrative.

## Safe Merge Pattern

1. merge executable spec changes first
2. run semantic diff
3. validate
4. re-approve if needed
5. merge or continue implementation

## Recommended Commands

```bash
spectra diff semantic
spectra check
spectra status
```

If behavior, contracts, or release thresholds changed, re-run the required approval stage before continuing.

## PR Patterns

### Pattern A: Spec and code together

Best when the change is small and reviewers can understand the bundle and code together.

### Pattern B: Specs first, code second

Best when:

- multiple contributors depend on the same feature contract
- the product/technical decision still needs review
- implementation is larger than the spec change

## Merge Safety Rules

- do not merge implementation that violates staged approval
- do not treat narrative Markdown as canonical if YAML says otherwise
- always run `spectra diff semantic` after a non-trivial spec merge
