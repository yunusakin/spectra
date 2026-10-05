# Business Rules: spectra-product

## RULE-SPE-001 — Explicit project migration

Project schema and layout change only through the explicit `spectra migrate` command. Non-interactive execution requires `--yes`, and `--check` never writes.

Status: active
Affected Modules: packages-cli
Governs: spectra-lifecycle#FR-1, spectra-lifecycle#AC-1
Evidence: packages/cli/src/commands/migrate.js; packages/cli/test/update.test.js ("migrate --yes runs non-interactively", "non-TTY migrate with declined input leaves a legacy layout untouched"); docs/lifecycle-verification.md
Confidence: high

## RULE-SPE-002 — Machine update does not migrate projects

`spectra update` updates only the machine application. It must not silently migrate, bootstrap or refresh any project; the retired `__update-project` path fails and points to `spectra migrate` or `spectra doctor --fix`.

Status: active
Affected Modules: packages-cli
Governs: spectra-lifecycle#FR-2, spectra-lifecycle#AC-2
Evidence: packages/cli/src/commands/update.js (help text and retired `__update-project`); docs/lifecycle-verification.md "Final lifecycle milestone"
Confidence: high

## RULE-SPE-003 — Uninstall never changes project files

`spectra uninstall` removes only verified, machine-owned Spectra installations. Project files are never changed, and an installation without a machine ownership record is left untouched.

Status: active
Affected Modules: packages-cli
Governs: spectra-lifecycle#FR-3, spectra-lifecycle#AC-3
Evidence: packages/cli/src/commands/uninstall.js (help text and legacy-installation refusal); packages/cli/test/native-installation-e2e.test.js
Confidence: high

## RULE-SPE-004 — Schema advances only after validation and stays recoverable

A project's schema version is committed only after the migration's validation passes. Migration snapshots valuable project content first and refuses to recover or continue over content that changed since the snapshot.

Status: active
Affected Modules: packages-cli
Governs: spectra-lifecycle#FR-4, spectra-lifecycle#AC-4
Evidence: commit 362dde5 "defer schema advancement until validation passes"; packages/cli/src/lib/project-migration.js (snapshot, schema-commit phase, "Valuable content changed"); packages/cli/test/migration-e2e.test.js; packages/cli/test/update.test.js ("migrate distinguishes a migration failure from a validation failure")
Confidence: high

## RULE-SPE-005 — Incompatible projects are refused

Project commands run only against a project whose schema and layout are current. Other states are refused with their compatibility status; only `status`, `doctor` and `migrate` may inspect a non-current project. Exceptions: `init`, `adopt` and installer operations on a directory that is not yet a project, and Spectra's own source repository (root-sdd layout without conflicts).

Status: active
Affected Modules: packages-cli
Governs: spectra-lifecycle#FR-5, spectra-lifecycle#AC-5
Evidence: packages/cli/src/lib/project-compatibility.js (assertProjectOperationAllowed); packages/cli/src/main.js
Confidence: high

## RULE-SPE-006 — Approval gates block implementation

Application code must not change before implementation approval. The approval stages are draft, product-approved, technical-approved, implementation-approved and release-approved; stages advance in sequence and a stage cannot be skipped.

Status: active
Affected Modules: packages-cli, packages-core
Governs: spectra-core#FR-2, spectra-core#AC-2
Evidence: sdd/features/spectra-core/feature.spec.yaml FR-2/AC-2; packages/core/assets/runtime/scripts/check-policy.sh (approval gate); packages/cli/src/lib/specs/stages.js; packages/cli/test/approval.test.js ("approval cannot skip intermediate stages beyond draft")
Confidence: high

## RULE-SPE-007 — Spec changes invalidate approvals

Changing a spec invalidates the approval stages that depend on the kind of change: scope increases invalidate every stage, contract breaks invalidate technical approval and later, behavior changes invalidate implementation approval and later. Re-approval restores the stage.

Status: active
Affected Modules: packages-cli
Governs: spectra-core#FR-3, spectra-core#AC-3
Evidence: packages/cli/src/lib/specs/approval-state.js (STAGE_INVALIDATION); packages/cli/test/approval.test.js ("editing projectbrief.md invalidates product approval and re-approval restores it", "editing a feature spec (yaml) invalidates approvals in a canonical project")
Confidence: high

## RULE-SPE-008 — Derived caches are not canonical

Everything under `.spectra/cache`, including the Repo Index and the Knowledge Map, is derived from canonical files and must be rebuildable from them. Deleting or corrupting a cache must not lose knowledge; a stale or corrupt cache is rebuilt or bypassed, never trusted.

Status: active
Affected Modules: packages-cli
Governs: spectra-core#INV-1
Evidence: docs/structure.md (`.spectra/cache/`); packages/cli/src/lib/knowledge/map.js (fingerprint rebuild, corrupt cache treated as missing); packages/cli/test/knowledge-map.test.js
Confidence: high

## RULE-SPE-009 — Knowledge objects have stable identities

Business rules, requirements and scenarios are addressed by their stable ID, never by file position or text prefix, so moving or reordering an object does not change its identity. Duplicate IDs are errors.

Status: active
Affected Modules: packages-cli
Governs: spectra-core#INV-2
Evidence: packages/cli/src/lib/business/rule-sections.js (identity is the full ID token); packages/cli/test/knowledge-map.test.js ("moving a rule updates the locator and map signature but keeps id and object signature", "duplicate rule IDs fail map generation deterministically")
Confidence: high

## RULE-SPE-010 — Mandatory context is never dropped

Baseline context, explicitly referenced objects and the requirement an explicitly named scenario covers are mandatory. Budget selection drops only optional context, in a deterministic order; if mandatory context alone exceeds the budget, it is returned in full and reported as `mandatory-overflow`, never truncated.

Status: active
Affected Modules: packages-cli
Governs: spectra-core#INV-3
Evidence: packages/cli/src/lib/context/selection.js (required entries, mandatory-overflow); docs/business-context.md; packages/cli/test/context-selection.test.js ("an explicit reference larger than the budget is still returned with mandatory-overflow", "an explicit AC keeps the FR it covers even when that overflows the budget")
Confidence: high
