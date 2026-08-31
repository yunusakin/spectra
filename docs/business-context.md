# Agent-Agnostic Business Context

Spectra stores durable product and business knowledge under `spectra/sdd/memory-bank/` so any agent can route work without depending on a vendor-specific memory system.

## Canonical Files

- `sdd/memory-bank/tech/modules.md` maps technical modules to paths and related business domains.
- `sdd/memory-bank/business/INDEX.md` maps business domains to configured routing keywords, rule files, unresolved-question files, and related technical modules.
- `sdd/memory-bank/business/<domain>/rules.md` stores active, superseded, and deprecated business rules.
- `sdd/memory-bank/business/<domain>/unresolved.md` stores questions and claims that are not yet durable rules.

Business rules use stable IDs and short metadata:

```markdown
## RULE-LOY-001 — Expiration

Expired points cannot pay for an order.

Status: active
Affected Modules: order-service
Evidence: Product policy, 2026-08-30
Confidence: high
```

## Routing

Use route-first context for business behavior:

```bash
spectra route --task "Change loyalty expiration" --format json
spectra context --role implementer --goal implement --route-task "Change loyalty expiration"
```

`spectra route` selects matching domains and modules, includes only their mapped files, and lists unrelated domain files as deferred. `spectra context` composes that route with the existing role and goal context pack, including token estimates for the routed files.

The business index supports both the legacy format and the keyword-aware format:

```markdown
| Domain | Keywords | Rules | Unresolved | Related Modules |
| --- | --- | --- | --- | --- |
| loyalty | point,points,reward,rewards,balance,expiration,expire | business/loyalty/rules.md | business/loyalty/unresolved.md | order-service |
```

Keywords are explicit configuration, not inferred by AI. Routing is deterministic and considers explicit domain/module hints first, then exact task matches, configured keywords, and module/domain relationships. JSON output remains backward compatible and adds explainability:

```json
{"domains":["loyalty"],"domainMatches":[{"name":"loyalty","matchedBy":"keyword","matchedValue":"points"}]}
```

## Knowledge Lifecycle

Use the CLI when possible:

```bash
spectra knowledge add --domain loyalty --title "Expiration" --statement "Expired points cannot pay." --status unresolved
spectra knowledge add --domain loyalty --title "Expiration" --statement "Expired points cannot pay." --status active --verified --evidence "Product policy"
spectra knowledge promote --id RULE-LOY-001
spectra knowledge supersede --id RULE-LOY-001
spectra knowledge deprecate --id RULE-LOY-001
```

Unresolved is the safe default. Direct active creation requires `--verified` and should be used only for authoritative evidence such as product documentation, approved specifications, existing verified rules, or explicit product-owner statements. Code behavior alone should normally be recorded as unresolved.

Direct markdown edits are allowed. `spectra check` validates duplicate IDs, invalid lifecycle state, unsafe index paths, missing files, unknown module/domain references, unindexed domain folders, malformed keywords, ambiguous keywords, and duplicate active statements.

## Adoption

`spectra adopt` creates a small provisional module map from top-level directories and an empty business-domain index. These outputs are explicitly unconfirmed; adoption does not infer business rules from code structure.
