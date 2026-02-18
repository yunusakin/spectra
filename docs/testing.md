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

## What `validate-repo.sh` Verifies

- Required paths and index references.
- Markdown link integrity across docs/rules/memory-bank.
- Adapter consistency (`AGENT.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`).
- Skills front matter + index coverage.
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

## Policy Script Test Scenarios

1. Baseline strict validation
- `bash scripts/validate-repo.sh --strict`
- Expect `Validation: OK`.

2. Baseline policy
- `bash scripts/check-policy.sh`
- Expect `Policy check: OK` on unchanged repo.

3. Open technical question blocks approval
- `Approval Status: approved` + one `open` question.
- Expect policy fail.

4. Missing issue reference for open question
- `open` question row without issue link.
- Expect policy fail.

5. Review-gate severity blocking
- unresolved `warning` -> fail.
- unresolved `critical` -> fail.

6. App code + open question
- non-README `app/` file exists and open question exists.
- Expect policy fail.

7. Invariant change trail
- range includes `core/invariants.md` change without `spec-history.md` or `arch/decisions.md`.
- Expect policy fail.

8. Range-aware mode
- `bash scripts/check-policy.sh --base <base> --head <head>`
- Expect same rules enforced over full range.

9. Docs-only range
- docs-only changes in range.
- Expect no false-positive policy failures.
