# Spec Merge Strategies

Specs are the source of truth. Merges should preserve semantic intent, not just resolve line conflicts.

## General Principles
- Prefer merging spec changes before (or together with) behavior-changing code.
- Keep spec history current: update `sdd/memory-bank/core/spec-history.md` when a merge changes requirements or constraints.
- If a merge changes a mandatory choice (stack/arch/API style), re-approval may be required (see `docs/workflow.md`).

## PR Patterns

### Pattern A: One PR (Specs + Code)
Best when:
- the change is small/medium
- reviewers can validate the spec and code together

Checklist:
- specs updated under `sdd/memory-bank/`
- validation passes (rules: `sdd/.agent/rules/intake/02-validation.md`)
- code changes under `app/` only (after approval)

### Pattern B: Two PRs (Specs First, Code Second)
Best when:
- requirements are still moving
- multiple implementations depend on the same spec update

Workflow:
1. PR 1 updates specs and gets explicit approval.
2. PR 2 implements under `app/` following the approved specs.

## Handling Conflicts

When conflicts happen in spec files:
1. Re-read the intent: requirements, constraints, and decisions.
2. Reconcile semantics manually (do not rely on "ours/theirs").
3. Update `sdd/memory-bank/core/spec-history.md` if the merged result changes meaning.
4. Consider updating `sdd/memory-bank/core/spec-diff.md` using `bash scripts/spec-diff.sh --update`.

## Merge Safety Rules
- Never merge code that violates the approval gate (code before approval).
- If the merge changes any mandatory field, treat it like a spec change that may require re-approval.
