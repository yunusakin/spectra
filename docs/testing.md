# Testing and Quality Checks

Spectra tests focus on process integrity (rules, indexes, links, policy invariants) plus workflow behavior.

## Automated Checks

Run strict validation:

```bash
bash scripts/validate-repo.sh --strict
```

Run policy checks (local default range):

```bash
bash scripts/check-policy.sh
```

Run policy checks for an explicit range:

```bash
bash scripts/check-policy.sh --base <base_sha> --head <head_sha>
```

Resolve skill order for a task type:

```bash
bash scripts/resolve-skills.sh --task-type api-change
```

## What `validate-repo.sh` Verifies

- Required paths and index references.
- Markdown link integrity across docs/rules/memory-bank.
- Adapter consistency (`AGENT.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`).
- Skills front matter + index coverage.
- Skill dependency map integrity (`dependency-map.tsv`).
- Prompt index coverage.
- Markdown template expectations.

## What `check-policy.sh` Verifies

- Approval-gate invariant for application code under `app/`.
- Canonical approval signal in `sdd/memory-bank/core/intake-state.md`.
- Open technical questions block approval and code progression.
- Open technical questions require issue references.
- Review-gate unresolved `critical`/`warning` findings are blocking.
- Invariant changes require decision trail updates.
- No unresolved placeholders in required specs.
- Progress tracking for `sdd/*` or `app/*` changes in checked range.
- Skill graph hard-fail for `app/*` changes:
  - `skill-runs.md` update required
  - required dependencies must exist
  - execution order must follow graph

## Policy Script Test Scenarios

1. Baseline strict validation
- `bash scripts/validate-repo.sh --strict`
- Expect `Validation: OK`.

2. Baseline policy
- `bash scripts/check-policy.sh`
- Expect `Policy check: OK` on unchanged repo.

3. Skill resolver baseline
- `bash scripts/resolve-skills.sh --task-type api-change`
- Expect ordered skills + `Skill resolution: OK`.

4. Required dependency fail
- `bash scripts/resolve-skills.sh --task-type api-change --skills testing-plan,api-design`
- Expect non-zero (required order/dependency violation).

5. Open technical question blocks approval
- `Approval Status: approved` + one `open` question.
- Expect policy fail.

6. Missing issue reference for open question
- `open` question row without issue link.
- Expect policy fail.

7. Review-gate severity blocking
- unresolved `warning` -> fail.
- unresolved `critical` -> fail.

8. App change without skill-run update
- range contains non-README `app/` file change but not `skill-runs.md`.
- Expect policy fail.

9. Skill-run order mismatch
- `skill-runs.md` row has graph-inverted order (e.g., `testing-plan,api-design`).
- Expect policy fail.

10. Invariant change trail
- range includes `core/invariants.md` change without `spec-history.md` or `arch/decisions.md`.
- Expect policy fail.

11. Range-aware mode
- `bash scripts/check-policy.sh --base <base> --head <head>`
- Expect same rules enforced over full range.

12. Docs-only range
- docs-only changes in range.
- Expect no false-positive policy failures.
