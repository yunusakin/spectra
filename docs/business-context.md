# Agent-Agnostic Business Context

Spectra stores durable product and business knowledge under `spectra/sdd/memory-bank/` so any agent can route work without depending on a vendor-specific memory system.

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
Evidence: Product policy, 2026-08-30
Confidence: high
```

## Routing

Use route-first context for business behavior:

```bash
spectra route --task "Change customer eligibility handling" --format json
spectra context --role implementer --goal implement --route-task "Change customer eligibility handling"
```

`spectra route` selects matching domains and modules, includes only their mapped files, and lists unrelated domain files as deferred. `spectra context` composes that route with the existing role and goal context pack, including token estimates for the routed files.

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

`spectra adopt` creates a small provisional module map from top-level directories and an empty business-domain index. These outputs are explicitly unconfirmed; adoption does not infer business rules from code structure.
