---
name: api-design
description: Design or review HTTP APIs. Use when adding or changing endpoints, request/response contracts, error formats, pagination, or versioning.
task_types: api-change,api-db-change,full-stack-change
---

# API Design Skill

## Purpose
Define consistent, well-structured APIs aligned with project standards.

## Inputs
- Endpoint name and HTTP method
- Resource model and identifiers
- Request/response examples
- AuthN/AuthZ requirements
- Expected error cases

## Steps
1. Confirm resource naming and HTTP method semantics.
2. Define request schema, validation rules, and field constraints.
3. Define response schema and success envelope.
4. Standardize error format and status codes.
5. Add pagination, filtering, and sorting for list endpoints.
6. Decide idempotency and retry behavior where relevant.
7. Check versioning strategy for breaking changes.
8. Identify required tests (unit, integration, contract).

## Outputs
- API design notes
- Updates to `sdd/memory-bank/core/projectbrief.md` (Requirements section) if needed
- Updates to `CHANGELOG.md` for breaking changes

## Checklist
- [ ] Resource naming is consistent
- [ ] Validation rules are explicit
- [ ] Error format is standardized
- [ ] Pagination/filtering defined if needed
- [ ] AuthN/AuthZ requirements documented
- [ ] Versioning impact assessed
- [ ] Tests identified

## Example Input
- Endpoint: POST /api/orders
- Request: { "customerId": "uuid", "items": [ {"sku":"X","qty":2} ] }
- Auth: JWT required

## Example Output
- Notes: uses 201 Created, returns OrderResponse
- Errors: 400 validation, 401 unauthorized

