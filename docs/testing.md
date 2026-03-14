# Testing and Quality Checks

Spectra tests focus on process integrity (rules, indexes, links, policy invariants) plus workflow behavior.

## Automated Checks

Run strict validation:

```bash
spectra validate
```

Run policy checks (local working-tree mode):

```bash
spectra validate
```

Run policy checks for an explicit range:

```bash
spectra validate --base <base_sha> --head <head_sha>
```

Resolve skill order for a task type:

```bash
spectra skills --task-type api-change
```

Run adapter generation smoke check:

```bash
spectra adapters --agents claude,cursor,windsurf,copilot,codex,antigravity --target /tmp/spectra-adapters
```

## What `validate-repo.sh` Verifies

- Required paths and index references.
- Markdown link integrity across docs/rules/memory-bank.
- Legacy v1 agent-specific paths are absent.
- `repo_mode` is valid and canonical/consumer constraints are enforced.
- Adapter generation is deterministic.
- Consumer adapter outputs, if present, match generated output.
- Skills front matter + index coverage.
- Skill dependency map integrity (`dependency-map.tsv`).
- Prompt index coverage.
- Context-pack manifest integrity.
- Markdown template expectations.

## What `check-policy.sh` Verifies

- Approval-gate invariant for application code under `app/`.
- Canonical approval signal in `sdd/memory-bank/core/intake-state.md`.
- Open technical questions block approval and code progression.
- Open technical questions require issue references.
- Review-gate unresolved `critical`/`warning` findings are blocking.
- Invariant changes require decision trail updates.
- No unresolved placeholders in required specs.
- Progress tracking for `sdd/*` or `app/*` changes in checked range for consumer repositories.
- Skill graph hard-fail for `app/*` changes:
  - `skill-runs.md` update required
  - required dependencies must exist
  - execution order must follow graph

## Policy Script Test Scenarios

1. Baseline strict validation
- `spectra validate`
- Expect `Validation: OK`.

2. Baseline policy
- `spectra validate`
- Expect `Policy check: OK` on unchanged repo.

3. Adapter generation baseline
- `spectra adapters --agents claude,cursor,windsurf,copilot,codex,antigravity --target /tmp/spectra-adapters`
- Expect `Adapter generation: OK`.

4. Skill resolver baseline
- `spectra skills --task-type api-change`
- Expect ordered skills + `Skill resolution: OK`.

5. Required dependency fail
- `spectra skills --task-type api-change --skills testing-plan,api-design`
- Expect non-zero (required order/dependency violation).

6. Open technical question blocks approval
- `Approval Status: approved` + one `open` question.
- Expect policy fail.

7. Missing issue reference for open question
- `open` question row without issue link.
- Expect policy fail.

8. Review-gate severity blocking
- unresolved `warning` -> fail.
- unresolved `critical` -> fail.

9. App change without skill-run update
- range contains non-README `app/` file change but not `skill-runs.md`.
- Expect policy fail.

10. Skill-run order mismatch
- `skill-runs.md` row has graph-inverted order (e.g., `testing-plan,api-design`).
- Expect policy fail.

11. Invariant change trail
- range includes `core/invariants.md` change without `spec-history.md` or `arch/decisions.md`.
- Expect policy fail.

12. Quick lane rejects app changes
- `spectra quick --type docs --task "refresh docs"` with `app/*` changes present.
- Expect quick lane fail.

13. Verify-work blocked state
- Leave unresolved `warning` in `review-gate.md`.
- Expect `spectra verify --scope app` to fail.

14. Range-aware mode
- `spectra validate --base <base> --head <head>`
- Expect same rules enforced over full range.

15. Docs-only range
- docs-only changes in range.
- Expect no false-positive policy failures.
