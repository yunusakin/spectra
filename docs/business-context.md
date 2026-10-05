# Agent-Agnostic Business Context

Spectra stores durable product and business knowledge under `.spectra/sdd/memory-bank/` so any agent can route work without depending on a vendor-specific memory system.

## Canonical Files

- `sdd/memory-bank/tech/modules.md` maps technical modules to paths and related business domains.
- `sdd/memory-bank/business/INDEX.md` maps business domains to configured routing keywords, rule files, unresolved-question files, and related technical modules.
- `sdd/memory-bank/business/<domain>/rules.md` stores active, superseded, and deprecated business rules.
- `sdd/memory-bank/business/<domain>/unresolved.md` stores questions and claims that are not yet durable rules.

Business rules use stable IDs and short metadata:

```markdown
## RULE-CUS-001 — Eligibility window

Requests outside the eligibility window require manual approval.

Status: active
Affected Modules: account-service
Governs: customer-policy#FR-1
Evidence: Product policy, 2026-08-30
Confidence: high
```

`Governs` is optional and lists, by stable ID, the feature requirements or scenarios (`<feature-id>#<object-id>`) the rule governs. It is canonical intent; the reverse direction is derived and never written. `spectra validate` rejects a malformed, duplicated or non-existent target, and more than one `Governs` line per rule. A rule without it stays valid and simply has no requirement link.

## Routing

Use route-first context for business behavior:

```bash
spectra route --task "Change customer eligibility handling" --format json
spectra context --role implementer --goal implement --route-task "Change customer eligibility handling"
```

`spectra route` selects matching domains and modules, includes only their mapped files, and lists unrelated domain files as deferred. `spectra context` composes that route with the existing role and goal context pack, including token estimates for the routed files.

With `--route-task`, matched business rules, feature requirements/scenarios and Repo Index records are resolved as exact objects (one rule section, one YAML object, one compact record) instead of whole files, and `selection` in the JSON output explains the budget decision. Baseline context, explicit references (for example `RULE-X-001` or `<feature>#AC-1`) and the requirement an explicitly named scenario covers are required and never dropped; optional objects and the module/domain index files are kept in deterministic priority order while they fit the role's `markdownTokens` budget and are otherwise listed under `selection.excluded`. `selection.status` is `within-budget`, `budget-exhausted` (optional context was dropped) or `mandatory-overflow` (required context alone exceeds the budget; nothing is truncated). Whole files replaced by exact objects are listed under `selection.superseded` (only files with addressable rules; a domain file without any stays in the pack whole), and `repoIndex.modules` is omitted in this mode. Plain `spectra context` is unchanged.

Business rules are matched to the task by their title and statement only: `Status`, `Affected Modules`, `Governs`, `Evidence` and `Confidence` lines never count as lexical evidence. A word that many rules of the same domain share (in at least two rules and in more than a third of them) cannot tell those rules apart and is ignored for that domain. When a matched domain has no rule-level match, all of its rules become candidates (`business-domain-match`) only if the caller asked for the domain (`--domain`) or the task states the domain's name or one of its keywords. A module hint, or a domain word that only occurs inside an explicit reference such as `<feature>#FR-2`, does not widen into the domain's whole rule set. The reason's `via` names the domain and the signal (for example `loyalty:keyword`).

## Traceability and verification

Traceability is what is connected to what; verification is what evidence currently supports those connections. They are separate questions: a path existing proves nothing passed.

Connections come from stable IDs, never from paths or text similarity: a rule's `Governs` line (rule to requirement or scenario), a scenario's `covers` (scenario to requirement), a rule's `Affected Modules` (resolved through `tech/modules.md` paths to Repo Index module records) and the Repo Index's own test-target records (module to test target). Reverse links are derived. Every edge carries a reason, and missing hops (requirement, module, test target) are reported rather than omitted.

A verification conclusion needs an explicit verification scope and fresh evidence. A requirement, scenario or invariant names the Repo Index test targets that are meant to verify it in an optional `verifiedBy: [<test-target-id>, ...]` list in its feature spec (the only place the relationship is written; the reverse is derived). `spectra validate` rejects a malformed, duplicated, self-referencing, missing or non-test-target entry; a spec without `verifiedBy` stays valid and simply has verification coverage that is incomplete. "The module has a test target" is traceability, not verification: a test target's result is attributed only to the subjects that name it, never to every requirement connected through the same module. Invariants (`invariants: [{id, statement, verifiedBy}]`, addressed as `<feature-id>#INV-1`, kind `architectural-invariant`) are the non-requirement subjects a rule can govern. Evidence is a recorded result for a Repo Index test target, kept in the local cache (`.spectra/cache/verification/`, never committed, safe to delete) together with the signatures of the subject, rule, module and test target it supported, taken before the tests ran. If any of those changes, or the result never observed the subject or rule, the evidence is `stale` for it. The conclusions are `verified`, `failed`, `stale` and `unverified`; approvals and review findings are not evidence. A subject is `verified` only when every target it names has fresh passing evidence, `failed` when a named target has a fresh failed result (the required verification scope failed; that does not mean the requirement is wrong), `stale` when a result exists but is outdated, and `unverified` when it names no scope or a named target has no evidence. A rule is `verified` only when every governed subject is verified and every affected module is accounted for: a module without a test target, or whose test targets no governed subject names, stays a visible gap (`gaps`, `modulesWithoutTestTarget`) and keeps the rule `unverified`; a fresh failure anywhere makes it `failed`. A scenario does not inherit its requirement's scope or the reverse, but a requirement is verified only when its own scopes are verified AND every scenario that canonically covers it (`covers`) is: a covering scenario that failed fails the requirement, a stale one makes it stale, an unverified one (no evidence, or no `verifiedBy`) leaves it unverified, with precedence failed > stale > unverified > verified. A requirement with no own `verifiedBy` stays unverified even if its scenarios are verified; a requirement with no covering scenario depends only on its own scopes. A rule's obligations are its governed subjects plus the scenarios covering them. `spectra verify --explain <id> [--json]` is read-only and shows the conclusion with every scope, gap and reason.

**Stage gates.** `spectra verify --gate <implementation|review|release> [--changed|--base <ref> [--head <ref>]] [--json]` is read-only and reports whether verification evidence lets that stage proceed (exit 1 when blocked, JSON `{stage, status, scope, blockers, warnings}`; every blocker names rule, subject, scope, evidence state, reason and the action to take). It never runs tests and never grants or changes approval. Implementation is always allowed, so a failed, stale or missing result can never block the edit that repairs it (it is still listed as a warning). Review and release are blocked by (a) a declared `verifiedBy` scope that failed (`failed-evidence`), is outdated (`stale-evidence`) or has no recorded result (`required-scope-no-evidence`), and (b) broken canonical structure (`broken-canonical-structure`; the validators still own structural validation). They only warn about `coverage-not-modeled` (a subject with no `verifiedBy`), `missing-canonical-subject`, `module-without-test-target` and `module-scope-not-named`: missing modeled coverage is reported, never treated as verified, and never blocks by itself. Review can be narrowed with `--changed` / `--base` to the rules concerned by the changed files (rules affecting a module that contains a changed file, rules defined in a changed file, rules governing subjects defined in a changed file); release is project-wide by design. `spectra verify` (all stages) includes the release gate as its `verification` stage. Evidence is target-level: one aggregate target that fails or is stale blocks every subject that names it, and the human output groups those blockers by target with a single rerun action. Approval and verification are independent: a satisfied gate grants nothing, and approval invalidation does not change evidence.

`spectra verify --test-target <id>` is the only thing that produces evidence. It runs the command the Repo Index recorded for that test target (for Node, `scripts.test`) once, from the target's directory, and records the completed result: exit 0 is `passed`, any other exit is `failed`. A run that does not complete (cannot start, signal, timeout, command not found) records nothing and keeps the previous record. It refuses an unknown target, a target without a recorded command and a stale Repo Index. It does not run the other verify stages, cannot be combined with `--scope` or `--item`, and does not run anything by default. A target is a module's whole test script, so evidence is target-level: a failure anywhere in it fails every subject that names the target as its scope (as a failed scope, not a claim about one requirement). A command that fans out to other targets is recorded as `aggregate` evidence and supports only the subjects that name that aggregate target; fan-out is recognised by pattern (npm `--workspaces`/`-ws`, `pnpm -r`, `lerna run`, `turbo run`, `nx run-many`, `yarn workspaces foreach`), so an unrecognised wrapper script is still recorded as the target's own command. A timeout stops the whole process tree, and concurrent recordings are serialised with a short-lived lock.

The business index supports both the legacy format and the keyword-aware format:

```markdown
| Domain | Keywords | Rules | Unresolved | Related Modules |
| --- | --- | --- | --- | --- |
| customer-policy | eligibility,limit,approval,manual-review | business/customer-policy/rules.md | business/customer-policy/unresolved.md | account-service |
```

Keywords are explicit configuration, not inferred by AI. Routing is deterministic and considers explicit domain/module hints first, then exact task matches, configured keywords, and module/domain relationships. JSON output remains backward compatible and adds explainability:

```json
{"domains":["customer-policy"],"domainMatches":[{"name":"customer-policy","matchedBy":"keyword","matchedValue":"eligibility"}]}
```

## Knowledge Lifecycle

Use the CLI when possible:

```bash
spectra knowledge add --domain customer-policy --title "Eligibility window" --statement "Requests outside the eligibility window require manual approval." --status unresolved
spectra knowledge add --domain customer-policy --title "Eligibility window" --statement "Requests outside the eligibility window require manual approval." --status active --verified --evidence "Product policy"
spectra knowledge promote --id RULE-CUS-001
spectra knowledge supersede --id RULE-CUS-001
spectra knowledge deprecate --id RULE-CUS-001
```

Unresolved is the safe default. Direct active creation requires `--verified` and should be used only for authoritative evidence such as product documentation, approved specifications, existing verified rules, or explicit product-owner statements. Code behavior alone should normally be recorded as unresolved.

Direct markdown edits are allowed. `spectra check` validates duplicate IDs, invalid lifecycle state, unsafe index paths, missing files, unknown module/domain references, unindexed domain folders, malformed keywords, ambiguous keywords, and duplicate active statements.

## Adoption

`spectra adopt` creates a provisional technical module map from the existing repo index's manifest records, falling back to top-level directories when no supported modules are found. Discovery documents include module paths, source roots, runtime/entrypoint evidence, declared test commands and test-tool dependencies where the index supports them. Maven test commands are explicitly labeled as conventional suggestions; adoption does not execute project commands or measure coverage.

Layout and configuration checks supplement that evidence. Categories without supported signals say so explicitly, and an index failure is reported rather than presented as successful discovery. All architectural interpretations and module responsibilities require review. The business-domain index starts empty; adoption does not infer business rules or project intent from code structure.

To reproduce the adoption discovery checks, run `node packages/cli/scripts/sync-assets.mjs` followed by `node --test packages/cli/test/adopt-discovery-e2e.test.js`. Each scenario prints the path to its retained discovery artifact for inspection, including Maven module/test evidence, Node workspace commands, and unsupported or malformed manifests.
