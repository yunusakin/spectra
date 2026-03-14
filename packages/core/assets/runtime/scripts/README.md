# Scripts

Helper scripts for development and maintenance.

## Conventions
- Small, single-purpose scripts.
- Document inputs, outputs, and side effects at the top of each script.
- Do not write to `app/` unless explicitly intended.

## Available Scripts

| Script | Purpose | When to use |
|--------|---------|-------------|
| `init.sh` | Installs Spectra core into a consumer repo, with optional `--adopt` discovery and `--agents` adapter generation | Once — when starting or adopting a project |
| `generate-adapters.sh` | Generates adapter files for Claude, Cursor, Windsurf, Copilot, Codex, and Antigravity | After install, or when adapter instructions change |
| `map-codebase.sh` | Produces unconfirmed brownfield discovery notes under `sdd/memory-bank/discovery/` | Before intake on an existing repo |
| `context-pack.sh` | Prints the ordered file list for a named Spectra task/context pack | Before reading context for a task |
| `discuss-task.sh` | Creates `implementation-brief.md` before coding | Before post-approval implementation |
| `validate-repo.sh` | Validates canonical system paths, manifests, skill metadata, prompt indexes, docs links, and adapter generation | Every push (runs in CI) |
| `check-policy.sh` | Checks approval/open-question/review-gate/invariant/progress policies + skill graph enforcement (`--base/--head` supported) | Every push/PR (runs in CI) |
| `resolve-skills.sh` | Resolves graph-compliant skill order for a task type and validates explicit skill order | Before any post-approval coding |
| `verify-work.sh` | Aggregates validation, policy, review-gate, traceability, and implementation-brief checks into a ready/blocked result | Before marking work ready |
| `quick.sh` | Runs a lightweight lane for docs/rules/spec/ops work and blocks if `app/*` changes exist | For small non-app tasks |
| `health-check.sh` | Prints a quick project health summary (intake, approval, sprint, tests, spec freshness) | Anytime — run manually for status |
| `spec-diff.sh` | Appends a markdown diff entry for spec changes under `sdd/memory-bank/` | After spec changes, before approval/re-approval |

## Skill Graph Commands

Resolve default order:

```bash
bash scripts/resolve-skills.sh --task-type api-change
```

Validate explicit order:

```bash
bash scripts/resolve-skills.sh --task-type api-db-change --skills db-migration,api-design,testing-plan
```

Non-zero exit means required dependency/order violation.

## `check-policy.sh` Range Mode

Local default mode evaluates working-tree and untracked changes.

For CI or explicit review ranges:

```bash
bash scripts/check-policy.sh --base <base_sha_or_ref> --head <head_sha_or_ref>
```

This enforces:
- approval gate for app code
- open technical question blockers
- issue reference requirement for open questions
- review-gate severity blockers
- invariant change trail requirement
- consumer-repo progress tracking requirement
- skill graph hard-fail for `app/*` changes

## New Workflow Helpers

Generate adapters:

```bash
bash scripts/generate-adapters.sh --agents claude,cursor,windsurf,copilot,codex,antigravity --target /path/to/repo
```

Map a brownfield repo:

```bash
bash scripts/map-codebase.sh --root /path/to/repo
```

Resolve context for a task:

```bash
bash scripts/context-pack.sh --task implementation-discuss
```

Create an implementation brief:

```bash
bash scripts/discuss-task.sh --item API-123 --task-type api-change --goal "Add search filters"
```

Run verify-work:

```bash
bash scripts/verify-work.sh --scope app
```

## CI Integration

`.github/workflows/validate.yml` runs:

1. `bash scripts/validate-repo.sh --strict`
2. `bash scripts/check-policy.sh` with CI-provided base/head SHAs
3. `bash scripts/resolve-skills.sh --task-type api-change` (smoke check)
4. `bash scripts/generate-adapters.sh --agents claude,cursor,windsurf,copilot,codex,antigravity --target /tmp/spectra-adapters` (smoke check)
