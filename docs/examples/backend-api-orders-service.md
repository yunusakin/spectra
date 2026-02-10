# Example: Backend API (Orders Service)

Use this as a reference for answering `init` prompts.

## Phase 1 (Core) Answers
- Project name: Customer Orders Service
- Primary purpose/goal: Manage customer orders, payments, and shipment status.
- App type: Backend API
- Primary language: Java
- Language version: 21
- Framework: Spring Boot
- Framework version: 3.2
- Architecture style: Hexagonal
- Primary data store: PostgreSQL
- Data store version: 16
- Deployment target: Kubernetes
- API style: REST

## Phase 2 (Type-Specific) Answers: Backend API
- Primary users: External B2B
- Domain/problem summary: Partners submit orders via API; internal staff track fulfillment.
- Key entities: Customer, Order, OrderItem, Payment, Shipment
- Must-have features:
  - Create order
  - Update order status
  - Retrieve order by id
  - Search orders by customer id
  - Publish status change events
- Authentication: OAuth2/OIDC
- Authorization model: RBAC
- Data access pattern: JPA/Hibernate
- Error model / response envelope: RFC7807 errors only
- Key endpoints / operations (top 5):
  - `POST /orders`
  - `GET /orders/{id}`
  - `GET /customers/{id}/orders`
  - `PATCH /orders/{id}/status`
  - `GET /health`
- Async needs: Domain events

## Phase 2b (API-Style) Answers: REST
- Versioning strategy: URL (`/v1`)
- Pagination/filtering: Cursor

## Phase 3 (Advanced, Optional) Answers (Example)
- Non-goals/exclusions: No UI; no multi-region in v1.
- Performance targets: p95 latency goal
- Scalability expectation: Horizontal scale
- Availability requirement: 99.9%
- Observability baseline: Logs+Metrics+Tracing
- Testing strategy: Unit+Integration
- Environments: Dev+Stage+Prod

## What You Should See Updated
- `sdd/memory-bank/core/projectbrief.md` (name, purpose, app type, product context, requirements, constraints)
- `sdd/memory-bank/tech/stack.md` (language/framework/db + versions)
- `sdd/memory-bank/arch/patterns-overview.md` (hexagonal)
