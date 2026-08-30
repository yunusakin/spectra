# Agent-Agnostic Business Context

Spectra stores durable product and business knowledge under `spectra/sdd/memory-bank/` so any agent can route work without depending on a vendor-specific memory system.

## Canonical Files

- `sdd/memory-bank/tech/modules.md` maps technical modules to paths and related business domains.
- `sdd/memory-bank/business/INDEX.md` maps business domains to their rule and unresolved-question files.
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

## Knowledge Lifecycle

Use the CLI when possible:

```bash
spectra knowledge add --domain loyalty --title "Expiration" --statement "Expired points cannot pay." --status unresolved
spectra knowledge promote --id RULE-LOY-001
spectra knowledge supersede --id RULE-LOY-001
spectra knowledge deprecate --id RULE-LOY-001
```

Direct markdown edits are allowed. `spectra check` validates duplicate IDs, invalid lifecycle state, unsafe index paths, missing files, unknown module/domain references, unindexed domain folders, and duplicate active statements.

## Adoption

`spectra adopt` creates a small provisional module map from top-level directories and an empty business-domain index. These outputs are explicitly unconfirmed; adoption does not infer business rules from code structure.
