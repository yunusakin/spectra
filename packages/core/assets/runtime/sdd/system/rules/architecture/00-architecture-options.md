# Architecture Options

## Decision Framework
Choose the simplest architecture that meets the requirements. Use this table as a guide:

| Architecture | Best For | Avoid When |
|---|---|---|
| **Layered** | Simple CRUD, small services, internal tools | Complex domain logic, multiple integration boundaries |
| **Hexagonal** | Complex domains, clear boundaries, high testability | Very simple CRUD where the overhead isn't justified |
| **CQRS** | Heavy read models, write/read separation, event sourcing | Simple apps with uniform read/write patterns |
| **Microservices** | Multiple teams, independent deployment, polyglot stacks | Small teams, early-stage products, tight coupling |
| **Event-driven** | Async workflows, integrations, decoupled producers/consumers | Simple synchronous flows, strong consistency requirements |

## Mandatory Checks (Agent MUST verify)
- [ ] Architecture choice is explicitly recorded in `sdd/memory-bank/arch/patterns-overview.md`
- [ ] The choice is justified against the table above (not just "we like it")
- [ ] If changing architecture after approval, follow the spec-change workflow (`00-spec-lifecycle.md`) and require re-approval

## When to Report Errors
If the architecture choice is missing or unjustified:
1. Ask the user to choose from the table above.
2. Record the choice and justification in `patterns-overview.md`.
3. Do not proceed to code generation without an explicit architecture choice.
