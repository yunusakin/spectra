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
- No unresolved placeholders in required specs.
- Progress tracking requirement when `sdd/*` or `app/*` changed in the checked range.

## Manual Workflow Regression Scenarios

1. Intake resume
- Start `init`, answer partially, stop, run `init` again.
- Expect only missing mandatory questions.

2. Validation correction loop
- Provide inconsistent answers (for example framework none + version set).
- Expect targeted validation follow-up.

3. Approval gate
- Attempt app code generation before `approved`.
- Expect workflow to block and ask for approval.

4. Full-stack coverage
- Choose Full-stack app type.
- Expect both backend and frontend follow-ups.

5. Spec change after approval
- Change mandatory field after approval.
- Expect spec update + re-validation + re-approval gate.

## Policy Script Test Scenarios

1. Baseline strict validation
- `bash scripts/validate-repo.sh --strict`
- Expect `Validation: OK`.

2. Policy local default
- `bash scripts/check-policy.sh`
- Expect pass on unchanged repo.

3. Range-aware pass (docs-only)
- `bash scripts/check-policy.sh --base <base> --head <head>` on docs-only range.
- Expect no progress-tracking violation.

4. Range-aware fail (spec/code changed without progress update)
- Include `sdd/*` or `app/*` changes without `sdd/memory-bank/core/progress.md`.
- Expect clear policy failure.

5. Approval-gate fail
- Include non-README `app/` file changes while approval status is not `approved`.
- Expect policy failure.

6. Approval-gate pass
- Same range with approval status set to `approved`.
- Expect policy pass.
