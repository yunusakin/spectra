# Agent-facing JSON contract

These outputs are the machine-readable contract for coding agents: `context --format json`, `route --format json`, `inspect ... --json`, `verify --explain <id> --json`, `verify --gate ... --json` and `status --json`. Generated adapters teach agents to call them through `./.spectra/bin/spectra`.

- **Version:** every document starts with `"contractVersion": 1`. It versions this output only; it is unrelated to the project `schemaVersion` and never triggers a migration. Fields are only added within a version.
- **Paths:** documents carry project-relative paths only. `repoRoot` (in `context` and `route`, including `route.repoRoot` in `--route-task` mode) is the data root relative to the project, for example `.spectra`. The per-entry `absolutePath` that `context` used to print is gone; `path` is unchanged. `context` and `route` JSON for equivalent projects is identical wherever they are checked out, apart from `repoIndex.generatedAt`, the time the Repo Index was built.
- **Errors:** an expected failure under `--json` / `--format json` prints one document on stdout and exits 1, with no stack trace and no absolute path: `{"contractVersion": 1, "ok": false, "error": {"code": "...", "message": "..."}}`. Codes: `invalid-arguments`, `project-not-found`, `subject-not-found`, `subject-not-inspectable`, `file-outside-project`, `invalid-ref`, `not-a-git-repository`, `command-failed`. Success documents have no `ok` or `error` field. Without a JSON request the failure is the usual `FAIL ...` line on stderr.
- **Exit status:** unchanged. `verify --gate` exits 1 only when the gate is `blocked`; `status --json` exits 1 when the project is not compatible with this application.
- **Read-only:** `inspect`, `verify --explain` and `verify --gate` never change canonical project intelligence, verification evidence or governance; they may rebuild the disposable Knowledge Map cache (derived, under `.spectra/cache/`, never committed) when it is cold or stale. `status --json` also writes nothing: it reports the recomputed approval state without persisting it (plain `status` persists it). `context` and `route` may refresh derived caches, as before.
- **Compatibility first:** call `spectra status --json` before any other command and proceed only when it exits 0 (`compatibility.status` is `CURRENT`; Spectra's own source repository is the documented exception and reports its `repo_mode` status with exit 0). Project compatibility is checked before a command is dispatched, so when it is `TOO_NEW`, `MIGRATION_REQUIRED` or `BROKEN` the other commands fail with a plain `FAIL ...` line on stderr, not the structured error document above; `status --json` reports that state as JSON.
- **Changed scope:** `--changed`, `--base` and `--head` report files relative to the project root, also when the project is a folder below the Git root; changes outside the project are not part of its scope (a change to code outside the project folder, such as a shared library in the same repository, is therefore not seen by the review gate).

## When to revisit MCP

Spectra's agent-consumption boundary is the CLI, this deterministic JSON and the generated adapters. MCP is not part of it. Reconsider a thin MCP adapter over the same documents only if evidence shows one of:

- agents still fail to discover or use Spectra despite the improved adapters;
- an important target agent cannot run the local CLI;
- typed tool discovery measurably increases real task success;
- the JSON contract fragments again despite the shared `contractVersion` and error shape;
- an important client requires MCP.

Any such adapter would call the same internal functions and return these same documents; no business logic belongs in a transport.
