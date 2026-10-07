# Changelog

## Unreleased

### Changed
- Public site and documentation alignment: the website described `spectra update` as a project command that asks before migrations; it now matches the product (update changes only the machine application, `migrate` is the explicit project step, `uninstall` leaves projects alone) and gains local/shared Git mode, the 24-command effects table (including `inspect`, `migrate` and `uninstall`), a current maintenance diagram, a workflow that covers context, inspect, verification evidence and the review/release gates, and an honest terminal example (no "release confidence: ready" claim from a bare `verify`). `quick-start` and `multi-project` no longer teach update-as-migration or a template-repository identity, the shipped guides are re-synchronized, and the docs vocabulary test now guards these claims. No product behavior, schema, retrieval, verification, gate or JSON-contract change.
- Source repository alignment: Spectra's own root `sdd/system` (manifest `spectra_version` was still 2.0.0, with retired `bash scripts/...` command spellings) and the packaged runtime's `sdd/system` (missing no consumer-visible behavior, but out of step with `profiles/full/sdd/system`) are re-synchronized with the consumer system source, the root `scripts/validate-repo.sh` gains the packaged validator's three-line generated-adapter detection (a hand-written `AGENTS.md`/`CLAUDE.md` is accepted either way), and the empty placeholder `app/README.md` and `sdd/adoption/` outputs are removed from the source repository. `node packages/cli/scripts/sync-assets.mjs --tracked` refreshes these mirrors and a new parity test fails when one drifts. The alignment also exposed a stale consumer source: `profiles/full/sdd/system/adapters/common-instructions.md` had lost the route-first and business-memory guidance that the packaged runtime copy kept, so adapters generated in newly initialized projects omitted it (the adapter unit test only passed because it generated from the source repository's own copy). It is restored, and an end-to-end test now checks a fresh consumer's `AGENTS.md`/`CLAUDE.md`. No schema, retrieval, verification, gate or JSON-contract change.
- Repository hygiene and documentation readiness: removed committed one-time observation artifacts (the lifecycle audit and verification result JSON, the 3.1.2 release verification record, the website review reports and screenshots, and the lifecycle design/plan notes; the verifiers in `tools/` still run in CI and write their results to temporary directories), refreshed the README (product thesis, new-vs-existing project choice, local vs shared mode, first commands, core concepts, verification evidence and gates, agent usage, update vs migrate vs uninstall), the npm package README and the site hero, documented verification evidence and gates in the testing and getting-started guides, and re-synchronized the shipped guides in `profiles/full/docs` with `docs/` (five had drifted). The retrieval evaluation baseline moves by 30 candidate tokens because one Spectra rule's evidence note changed. No product behavior, schema, retrieval, verification or JSON-contract change.
- Retrieval term folding: lookup terms now fold `-ing`/`-ed` variants after the existing plural fold (`counting`/`counted` -> `count`, `rejecting`/`rejected`, `recording`/`recorded`; `stopped` -> `stop`), so a task like "assertion counting" reaches an invariant that says "counted" under the unchanged two-shared-term rule. The stem must stay at least four letters (`being`, `thing`, `running`, `added` are left alone), doubled l/s/z/f are kept (`installed`), a folded term never re-admits a STOP term, and `-ion`/`-al`/trailing-`e` forms (`project`/`projection`) are deliberately not folded. The official evaluation moves from precision 68.6% to 70.2%, false positives 27 to 25 and candidate tokens 13120 to 13071; required recall stays 100%. The derived Knowledge Map contract moves to version 6 and old caches rebuild automatically; no project schema change or migration.
- Final validation closure: `spectra context --route-task` now matches architectural invariants to the task by the same term-overlap rule as requirements and scenarios (previously only explicit IDs reached them; unrelated invariants are still not selected and invariants stay optional), and `spectra verify --test-target` runs a Node package script from its directory with that directory's `node_modules/.bin` first on `PATH`, as `npm run` does, so scripts calling locally installed tools no longer exit 127. The retrieval baseline gains one non-selected candidate. No schema, evidence-format, identity, gate or JSON-contract change.
- Real-world closure (dogfood findings): re-running `spectra adopt`/`init` on an installed project no longer resets reviewed intelligence (business domain index, appended-only module rows, feature bundles, governance state) or recreates a removed starter feature (`map-codebase.sh --preserve-reviewed`). Verification evidence freshness no longer counts Spectra's own writes: inside `.spectra/` only feature specs, business `rules.md` and `tech/modules.md` stale evidence, so caches, reports, evidence, approvals and progress notes cannot (shared mode previously made every run invalidate the last). Shared mode writes `.spectra/.gitignore` for `cache/` and `evals/reports/`; `inspect --changed` and the narrowed review gate ignore Spectra-derived files. `check` warns about unresolved `Affected Modules` (same data the gates block on), `knowledge add`/`promote` warn when a domain has no routing keywords or modules, `onboard` lists what `check` will still reject, and an unmodified starter feature no longer counts as a consumer feature in adoption gap analysis or release checklist readiness. No schema change or migration; retrieval, traceability, verification states, gate and impact semantics are unchanged.
- Agent consumption contract: generated adapters (every target, from the shared `common-instructions.md`) gain a "Project Intelligence" section (no canonical, governance, approval or evidence mutation; `context` and `route` may refresh derived caches) that says when to use `context`, `inspect <id>`, `inspect --changed`, `verify --explain` and `verify --gate review|release`, always through `./.spectra/bin/spectra`. The agent-facing JSON (`context --format json`, `route --format json`, `inspect --json`, `verify --explain --json`, `verify --gate --json`) now starts with `"contractVersion": 1` (additive; unrelated to project `schemaVersion`, no migration). `repoRoot` in `context` and `route` JSON is relative to the project (`.spectra`, was absolute), `context` entries no longer print `absolutePath` (use `path`), and the discovery summary cache records its `source` project-relatively, so equivalent projects produce the same context JSON wherever they are checked out. Under `--json` an expected failure (unknown subject, bad arguments, no project, bad ref) is one structured `{"ok": false, "error": {"code", "message"}}` document with exit status 1 instead of `FAIL ...` text. Human output, retrieval, traceability, verification, gates and impact are unchanged.
- Verification hardening: the Node scanner records every `scripts."test:<name>"` as a named Repo Index test sub-target (`node:test-target:<path>:test:<name>`, run from the package directory) next to the aggregate `scripts.test` target. Spectra's own lifecycle, approval and invariant subjects now name the narrow sub-targets that verify them instead of the whole CLI suite, so an unrelated native-installer failure fails only the uninstall subjects. `spectra verify --gate` refuses an unresolvable `--base`/`--head` ref and falls back to the whole project (with a `scope-undeterminable` warning) outside a git repository; `spectra verify --test-target` no longer passes an outer `NODE_TEST_CONTEXT` to the command it runs; `spectra check` accepts handwritten `AGENTS.md`/`CLAUDE.md` in a canonical repository and still rejects committed Spectra-generated adapters. Evidence also goes stale when the git-tracked files under the target's directory change (content fingerprint around the run, local cache only); watch-mode `test:*` scripts are not recorded as targets; generated-adapter detection compares the first three lines. The derived Knowledge Map and Repo Index rebuild automatically; no schema change or migration.
- Verification gates and convergence: `spectra verify --gate <implementation|review|release> [--changed|--base <ref> [--head <ref>]] [--json]` reports, read-only, whether the recorded evidence lets a stage proceed. Implementation is never blocked; review and release are blocked by a declared `verifiedBy` scope that failed, is stale or has no result, and by broken canonical structure, each blocker naming the rule, subject, scope and rerun action; unmodeled coverage only warns. `spectra verify` includes the release gate as its `verification` stage (5 points of the release confidence score, taken from telemetry). A narrowed review whose changed files concern no rule reports `no-rules-in-scope`; files no other module owns concern the root module. A requirement is now verified only when its own scopes and every scenario covering it are verified. Metrics gain required-subject counts and per-stage blocked rules. Nothing reruns tests automatically and no approval is granted; no schema change or migration.
- Verification semantics: a requirement, scenario or invariant is verified only through its own explicit `verifiedBy: [<test-target-id>]` scope (optional feature-spec metadata, validated by `spectra validate`); a module's test target no longer verifies every requirement connected through it. A rule is verified only when every governed subject is verified and every affected module is covered; untested modules stay a visible gap, a fresh failed scope makes it `failed`. Feature specs gain an `invariants` list (kind `architectural-invariant`) for non-requirement subjects, a new `spectra-lifecycle` feature bundle describes RULE-SPE-001..005, and `spectra verify --explain <id> [--json]` is a read-only explanation. Metrics distinguish canonical, scope, execution and verified coverage. The derived Knowledge Map contract moves to version 5 (caches rebuild automatically; no schema change or migration).
- `spectra context --route-task` selects resolved knowledge within the existing role budget: baseline and explicit references are never dropped (overflow is reported as `mandatory-overflow`), optional objects are included by deterministic tier or listed under `selection.excluded`. JSON gains `selection` (status, budgets, included, excluded, superseded, warnings); `repoIndex.modules` is omitted in route mode, and `route.entries[].selection` marks whole files replaced by exact objects. Plain `spectra context` is unchanged.
- `spectra context --goal implement` (with or without `--route-task`) now adds the compact project summary instead of the full project brief when there is no active implementation item. The full brief remains on the implementer's escalation list. Plain `spectra context` output for that role therefore shrinks (about 680 -> 220 tokens of orientation); no schema or budget change.
- `spectra context --role release-manager --goal ship` now carries a derived summary of the release being shipped (`Unreleased`, else the highest version) instead of the whole `RELEASE_SUMMARY.md`; the full file is an escalation entry. Mandatory markdown for that role drops from about 1670 to 375 tokens on this repository. No schema or budget change.
- `spectra context --goal decide` (planner and architect) now points at a derived copy of the project brief with `<!-- ... -->` authoring comments removed and all other content verbatim; the raw brief is an escalation entry. On this repository the brief drops from about 681 to 426 tokens. No schema or budget change.
- `spectra verify --test-target <id>` runs one Repo Index test target's recorded command and records the completed result as local verification evidence (`.spectra/cache/verification/`, never committed); rules and requirements report `verified`, `failed`, `stale` or `unverified` from it. Nothing runs without the flag. The feature spec `spectra-core` gains FR-3/AC-3 (spec changes invalidate approvals), governed by RULE-SPE-007.
- Business rules accept an optional `Governs: <feature-id>#<object-id>, ...` metadata line (canonical rule-to-requirement link); `spectra validate` checks syntax, duplicates and targets. Projects without it are unaffected. The derived Knowledge Map contract moves to version 4 and old caches rebuild automatically; no schema change or migration.
- `spectra update` updates application software only; project layout and installation-schema changes use the explicit, per-project `spectra migrate` command.
- Documentation distinguishes the synchronized application release, numeric project `schemaVersion`, and the `spectra/v2` contract namespace.
- Native application updates retain verified version directories and preserve original executable bytes for update recovery; no public rollback command is provided.

### Added
- `spectra status --json`: the same recent updates, approval state and next action as the human view, rendered from one shared status state.
- `spectra inspect <id> [--json]` and `spectra inspect --changed | --base <ref> [--head <ref>] | --file <path> [--json]`: a read-only Project Intelligence query over existing traceability, verification and gate semantics. It explains one rule, requirement, scenario, invariant, module or test target (relationships marked canonical or derived, verification conclusion identical to `verify --explain`, review/release gate) and reports the impact of changed files (modules, subjects, rules, verification scopes, gate implications, each with a deterministic reason). The changed-file-to-rule logic moved out of the review gate into one shared function, so impact and `verify --gate review` agree. No new storage, no schema change or migration.
- `spectra uninstall` removes verified managed native application files while leaving projects, adapters and Git exclusions unchanged. npm, npx and project-local fallback guidance follows installation provenance.

### Documentation
- Setup and lifecycle guides explain install-once, application update, explicit migration, fallback behavior and network-source limits; the CLI reference covers all 23 public commands and their project effects.

### Fixed
- `spectra knowledge promote|supersede|deprecate` no longer matches a rule whose ID merely starts with the requested ID (for example `RULE-X-001` vs `RULE-X-0010`).
- `spectra check` rejects duplicate feature `metadata.id` values and duplicate requirement/scenario IDs inside one feature spec.

### Internal
- Business-rule section parsing is consolidated in `business/rule-sections.js`; `knowledge/address.js` resolves rules and feature objects (`<feature-id>#FR-2`) by stable ID. Internal only, no new command and no schema change.
- A derived Knowledge Map (`.spectra/cache/knowledge/knowledge-map.json`) indexes business rules, feature objects and Repo Index records by stable ID with content signatures and fresh/stale/missing detection. Internal only: not used by `spectra context`, disposable, and needs no migration.
- `spectra context --route-task` now resolves exact knowledge objects from the Knowledge Map (rule sections, feature requirements/scenarios, Repo Index records) with per-item reasons, replacing the matched domains' whole rule files. Output is additive (`knowledge`, entry `knowledgeId`/`reasons`/`content`); plain `spectra context` is unchanged.

## [3.1.2] - 2026-10-02

### Added
- Generated agent guidance directs compatible plugin and skill documents to `.spectra/docs/<project-name>/<plugin-or-skill>/`, while preserving paths required by the tool or artifact contract.
- Installation records a stable project documentation name; shipped Spectra guides use `.spectra/docs/spectra/`.

### Fixed
- Refresh commands launched from the project-local npm fallback preserve the executing CLI instead of deleting its own runtime files.
- `adopt` discovery uses repository index evidence for module, source, test and command summaries, including Maven source overrides and unnamed root modules. Discovered business responsibilities remain unconfirmed; application commands are not executed during discovery.
- Runtime refresh and `doctor --fix` preserve unowned guide collisions and plugin documents; adapter generation honors the target project's ownership and Git policy.
- Website release notes follow the latest published release, and onboarding/storage descriptions match the CLI behavior.

### Documentation
- README, CLI Reference, installed guides and website describe the project effects of all 21 public commands, including cache/state/report writes and conditional behavior.
- Website setup, daily work and maintenance diagrams use the site's card styling and native SVG typography, with complete HTML explanations, compact shapes and no nested vertical scrolling.

## [3.1.1] - 2026-09-28

### Added
- Release verification checks nested release-checklist items and blocks approval while any item remains incomplete.

### Changed
- Installation uses the unified Full runtime without profile selection; `spectra verify` runs release-readiness checks by default.
- Release approvals remain valid across invocations and are invalidated when relevant semantic project scope changes.

### Fixed
- Native `spectra context` works on repeated calls and refreshes summaries after project state changes.
- Generated Full agent adapters direct project state updates to `.spectra/sdd/`.
- Approval refuses uncommitted changes that would immediately invalidate the requested stage.
- Lite runtime guidance and context packs reference only files installed with Lite.

## [3.1.0] - 2026-09-24

Post-consolidation correctness release. No new product capabilities; the `spectra/v2` schema identifier is unchanged.

### Fixed
- **Release approval deadlock.** `verify --profile release` required `release-approved`, the state `approve --stage release-approved` was trying to grant. Release readiness now requires at least `implementation-approved`, so the documented sequence can succeed.
- **Approval stages can no longer be skipped from `draft`.** `draft -> technical-approved` (and further) was accepted and left `current_state` ahead of the computed `highest_valid_state`.
- **Release approval enforces `verify-work.sh`.** `approve --stage release-approved` previously assumed the shell checks passed; it now runs them through the same runner as `spectra verify`.
- **Canonical `.spectra` root for shell-backed commands.** `spectra diff init/update` failed with a false "missing .git" error in every canonical project; `spec-diff.sh` now checks for a Git work tree and reports data-root-relative paths (which also makes its exclude list effective). `spec-diff.sh --patch` no longer fails on a stray command substitution or on empty change categories under bash 3.2.
- **Policy path namespaces.** `check-policy.sh` compared repo-root-relative tracked paths and data-root-relative untracked paths against `sdd/...` patterns, so results depended on Git state. All modes now use data-root-relative paths. Note: tracked, uncommitted edits under `sdd/` were previously invisible to the "progress.md must be updated" rule in canonical projects; they now count, as intended.
- **`health-check.sh`** scans the project (not `.spectra`) for tests and reads `install.json` from the data root. Scripts now receive `SPECTRA_DATA_ROOT` alongside `SPECTRA_PROJECT_ROOT`; `SPECTRA_REPO_ROOT` remains as a legacy alias for the data root.
- **Install no longer deletes user files.** Finder-artifact cleanup is limited to `.spectra/`; previously it removed `.DS_Store` files anywhere in the project.
- **`spectra doctor`** does not require `node` on `PATH` when running as a native binary.
- **Local Git mode** only treats root `spectra/` and `sdd/` as Spectra-owned when they carry a Spectra marker (`install.json` / `system/manifest.env`); ordinary company directories with those names no longer block install.
- **Migration** removes only Git exclude lines Spectra recorded in `install.json`; identical-looking user rules (`/docs/`, `/sdd/`, `/spectra/`) survive.
- **Approval invalidation in canonical projects.** Git reports `.spectra/sdd/...` paths, which the semantic-diff and context-pack matchers (written against `sdd/...`) never matched, so edits to `projectbrief.md` and to feature spec `.yaml` files did not invalidate approvals. Changed-file paths are now normalized once in `git-diff.js`.
- **`spectra adapters` and `doctor --fix` no longer overwrite user-written adapter files** (e.g. an existing `CLAUDE.md`), and neither does `init`/`adopt`/`upgrade --agents`, which refuses before installing anything. Files without the Spectra header are refused unless `adapters --force` is passed; `doctor --fix` only restores missing adapters.
- **Shipped Full-profile rules taught `bash scripts/...` invocations** (`resolve-skills.sh`, `validate-repo.sh --strict`, `spec-diff.sh --update`) that do not exist in consumer projects. They now teach `spectra skills`, `spectra check` and `spectra diff update`.
- **Adopt discovery no longer reports `.spectra/` as project content.** `map-codebase.sh` excluded the legacy `sdd/` and `spectra/` names but not `.spectra`, so it listed `.spectra` as a module and filled its 20-line test list with Spectra's own files, hiding the project's real tests.
- **Generated release contract** no longer requires a `tests` gate that verify never evaluates (now `verify_work`), and generated text no longer says "verify v2" or "run spectra validate".

### Changed
- The source `scripts/` tree is synchronized with the packaged runtime scripts; the only intentional difference (`validate-repo.sh`) is documented and tested.
- Docs-vocabulary tests also cover the scripts READMEs.
- Internal: layout detection (`detectLayout`) is confined to `project-layout.js` and `migration.js`; `runtime.js` and `context/roots.js` use `findProjectRoot` / `getActiveRoot`. `feature-bundles.js` defaults are split into spec, eval and governance modules, and `context/summaries.js` into memory and governance summary modules; summary-cache invalidation now covers every module in `context/`. Generated scaffolding and context summaries are byte-identical.
- `spectra status` recommends re-approval when approvals were invalidated; otherwise it still suggests `spectra check`.
- Docs define agent adapter files as regenerable projections of `.spectra/` state.

## [3.0.9 development notes]

Consolidation and reliability release. No new product capabilities.

### Changed
- `.spectra/` is the single canonical project root; everything Spectra manages, including the local launcher (`.spectra/bin/spectra`), lives beneath it. The 3.0.8 `spectra/` layout and the pre-3.0 root `sdd/` layout are migration inputs only.
- Public commands are canonical internally: `context`, `task`, `eval`, `skills`, `adapters`, `diff`. The old forms (`context-pack`, `discuss-task`, `eval run`, `skills resolve`, `adapters generate`, `spec diff`, `admin <command>`) keep working through a compatibility layer and are no longer taught in help or docs.
- `spectra help` groups commands by workflow.
- `spectra verify` reports its shell-check stage as `verify-work` instead of `tests`; it never ran project tests. The report title is now `Spectra Verify`. Scoring is unchanged.
- Warnings and failures are written to stderr; normal output stays on stdout.
- `specs.js` and `context.js` are split into focused modules behind unchanged facades.

### Fixed
- Invalid CLI input fails early: unknown flags, string flags without a value or consuming another flag, and non-boolean values for boolean flags.
- `spectra update` reports success only after post-update validation passes and distinguishes migration failures from validation failures. Added `--yes` for non-interactive runs.
- Migration no longer risks partial moves: the legacy `spectra/` directory is removed last, the root-`sdd/` move happens last, half-finished migrations are reported instead of treated as complete, conflicting `spectra/` and `.spectra/` trees are left untouched with an actionable error, and a Spectra source repository is always refused.
- Test discovery is deterministic and CI runs the suite on Node 20 and 22. Version parity now also covers `init.sh`.

## Historical: pre-3.0 project layout notes

Undated notes from before this project moved to per-version headings below; content predates `v2.0.0`. This work was intended for `v3.0.0` because the generated project layout changes from root-level Spectra directories to the single `spectra/` boundary.

### Added
- Lite and Full installation profiles with Lite as the default.
- Simplified `help`, `check`, `status`, and `update` workflow commands.
- `spectra admin` grouping for Full-profile advanced commands while retaining compatibility aliases.
- Project schema and runtime version metadata.

### Changed
- Generated Spectra-owned content now lives beneath one `spectra/` directory.
- Local Git mode is now the default and excludes `/spectra/` through `.git/info/exclude`.
- Native and npm installations share the same profile assets and update behavior.

### Migration
- `spectra update` safely migrates legacy `.spectra/`, root `sdd/`, and known Spectra-generated documentation while preserving company files and working context.

## [v2.0.2] - 2026-07-06

### Fixed
- Made `spectra status` detect tests across brownfield repository layouts, including JVM `src/test/` trees.
- Counted only real traceability table rows instead of commented examples and status legends.
- Reported unstarted template state and uncommitted executable specs accurately.

### Changed
- Added brownfield health assertions to the native release smoke matrix.

## [v2.0.1] - 2026-06-12

### Added
- Native macOS/Linux install path through GitHub Release artifacts and `install.sh`.
- Repo-local `.spectra/bin/spectra` launcher for initialized and adopted projects.

### Changed
- Simplified the public CLI by removing the separate `spectra feature` scaffolding command.
- Aligned package, CLI, native, and runtime versions on `2.0.1`.

## [v2.0.0] - 2026-03-07

### Added
- Agent-independent canonical runtime under `sdd/system/`.
- New commands:
  - `scripts/generate-adapters.sh`
  - `scripts/map-codebase.sh`
  - `scripts/context-pack.sh`
  - `scripts/discuss-task.sh`
  - `scripts/verify-work.sh`
  - `scripts/quick.sh`
- New canonical manifests and memory-bank assets:
  - `sdd/system/manifest.env`
  - `sdd/system/runtime/context-packs.tsv`
  - `sdd/system/adapters/`
  - `sdd/memory-bank/core/implementation-brief.md`
  - `sdd/memory-bank/core/activeContext-archive.md`
  - `sdd/memory-bank/discovery/`

### Changed
- Migrated canonical runtime content from `sdd/.agent/` to `sdd/system/`.
- Refactored `scripts/init.sh` to support core-only install, `--adopt`, and `--agents`.
- Refactored `scripts/validate-repo.sh` to validate canonical/consumer repo modes and smoke-test adapter generation.
- Updated docs and CI to the v2 agent-independent model.

### Removed
- Legacy canonical path `sdd/.agent/`.
- Committed root adapter files from the Spectra source repo.
- Legacy root files `AGENT.md` and `.cursorrules`.

## [v1.0.2] - 2026-02-22

### Added
- Feature: Token-Efficient Intake Context
  - Split intake questions into phase/app-type packs under `sdd/system/rules/intake/questions/`.
  - Added runtime minimal loading manifest: `sdd/system/runtime/minimal.md`.
- Feature: Skill Graph Enforcement
  - Added canonical skill dependency map: `sdd/system/skills/dependency-map.tsv`.
  - Added skill run ledger: `sdd/memory-bank/core/skill-runs.md`.
  - Added resolver CLI: `scripts/resolve-skills.sh`.

### Changed
- Converted `sdd/system/rules/intake/01-questions.md` into a lightweight router.
- Updated `sdd/system/rules/intake/00-intake-flow.md` to load only relevant question packs.
- Updated adapter read-first contract to include `sdd/system/runtime/minimal.md`.
- Updated `sdd/system/rules/index.md` and `sdd/system/README.md` for runtime + pack discovery.

### Enforced
- Skill graph hard-fail checks in `scripts/check-policy.sh` for `app/*` ranges:
  - requires `skill-runs.md` updates
  - validates dependency order and required edges
- Repository validation in `scripts/validate-repo.sh` for:
  - skill `task_types` front matter
  - `dependency-map.tsv` integrity and known skill references

## [v1.0.1] - 2026-02-18

### Added
- Canonical intake decision governance with `Decision Log` and `Open Technical Questions` in `sdd/memory-bank/core/intake-state.md`.
- New core templates:
  - `sdd/memory-bank/core/invariants.md`
  - `sdd/memory-bank/core/review-gate.md`
- New governance rules:
  - `sdd/system/rules/intake/04-question-contract.md`
  - `sdd/system/rules/intake/05-question-catalog.md`
  - `sdd/system/rules/workflow/03-role-loop-gate.md`
  - `sdd/system/rules/workflow/04-escalation-policy.md`
- GitHub issue template for unresolved technical intake decisions:
  - `.github/ISSUE_TEMPLATE/intake-question.yml`

### Changed
- Updated intake, approval, lifecycle, sprint, and verification rules to enforce:
  - explicit technical decision confirmation
  - open-question blocking before approval
  - role-based quality gate sequencing
- Updated `scripts/init.sh` to prefill new intake-state sections.
- Updated docs and adapters to reflect decision loop, quality gate loop, escalation, and open-question lifecycle.
- Updated CI validation workflow messaging for range-aware policy checks.

### Enforced
- `scripts/check-policy.sh` now blocks when:
  - approval is `approved` while open technical questions exist
  - `app/` code exists while open technical questions remain
  - open technical questions have no valid issue reference
  - unresolved `critical`/`warning` findings exist in `review-gate.md`
  - `invariants.md` changes without `spec-history.md` or `arch/decisions.md` trail updates

## [v1.0.0] - 2026-02-17

### Added
- First stable Spectra release.
