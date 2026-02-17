# Discovery Mode

## Purpose
When a user cannot answer a technical question during intake, the agent provides contextual recommendations based on previously collected project information.

## Trigger
Activate discovery mode when the user responds with any of:
- "I don't know", "not sure", "recommend", "suggest", "you decide", "help me choose"
- "bilmiyorum", "emin değilim", "öner", "sen seç", "karar veremedim", "ne kullanayım"
- Or any equivalent phrasing indicating uncertainty.

If the user says "decide everything" / "you choose all" / "hepsini sen seç", skip to § Full-Stack Package Recommendations below.

## Hard Rules
- Only activate for technical/architectural questions. Never for business/domain questions (project name, purpose, features, entities, endpoints, timeline).
- Always base recommendations on information already collected: project name, purpose, app type.
- Present 2-3 options with one-line pros/cons, then state your recommendation with a brief reason.
- Accept the user's final choice without argument. If they override your recommendation, proceed normally.

## User Interaction Rules
Discovery mode is a **conversation**, not an automated decision. The user must always remain in control.

- **Always confirm.** After every recommendation, ask the user if they agree before writing anything to spec files. Never auto-fill a discovery answer without explicit user confirmation.
- **Allow overrides.** If the user disagrees with a recommendation, respect their choice immediately. Do not push back or re-recommend.
- **Allow changes.** The user can revisit and change any previously answered question at any time during intake. If they say "actually, change the database to MongoDB", update the spec files accordingly.
- **Allow discussion.** If the user wants to discuss pros/cons in more depth before deciding, engage in that conversation. Provide more details, trade-offs, or real-world examples as needed.
- **Nothing is final until approval.** All discovery recommendations are written to spec files as drafts. The user reviews everything at the approval gate and can request changes before approving.
- **Partial discovery.** The user may use discovery for some questions and answer others directly. Do not force discovery mode for all remaining questions once activated.

## Discovery Announcement
Before Phase 1b (technical questions), inform the user once:

> "We're moving to technical questions now. If you're unsure about any answer, just say **'recommend'** and I'll suggest the best option based on your project."

Do not repeat this announcement. One time only.

## Per-Question Decision Trees

### Primary Language
Decision factors: app type, ecosystem maturity, hiring pool.

| App Type | Recommendation | Reason |
|----------|---------------|--------|
| Backend API | Node.js or Go | Fast development (Node.js) or high performance (Go) |
| Web / Full-stack | TypeScript (Node.js) | Shared language front+back, Next.js ecosystem |
| Mobile | TypeScript | React Native cross-platform |
| CLI | Go | Single binary, fast startup, cross-compile |
| Worker/Batch | Python or Go | Python for data tasks, Go for performance |
| Library/SDK | Match consumer ecosystem | If consumers use Java → Java, etc. |

### Framework
Decision factors: chosen language, project size, team experience.

| Language | Small/MVP | Medium/Large |
|----------|----------|-------------|
| Node.js/TS | Express | NestJS |
| Node.js/TS (full-stack) | Next.js | Next.js |
| Python | FastAPI | Django |
| Go | Fiber | Gin |
| Java | Spring Boot | Spring Boot |
| .NET | ASP.NET Core | ASP.NET Core |

### Architecture Style
Decision factors: project complexity, team size, expected growth.

| Complexity | Recommendation | When to Use |
|-----------|---------------|------------|
| Simple / MVP / solo dev | Layered | Quick to build, easy to understand |
| Medium / 2-5 devs | Hexagonal | Testable, clean boundaries |
| Complex domain / large team | CQRS | Separate read/write, scalable |
| Many independent services | Microservices | Independent deployment, team autonomy |
| Real-time / event-heavy | Event-Driven | Async processing, decoupled |

Default: **Layered** unless the project clearly needs more.

### Primary Data Store
Decision factors: data model, query patterns, scale.

| Data Shape | Recommendation | Reason |
|-----------|---------------|--------|
| Relational (users, orders, products) | PostgreSQL | Most versatile, strong ecosystem |
| Document/flexible schema | MongoDB | Schema flexibility |
| Simple/local/embedded | SQLite | Zero config, great for CLI/small apps |
| Key-value / caching | Redis | In-memory speed |
| Time-series | TimescaleDB | Built on Postgres, optimized for time data |

Default: **PostgreSQL** — it covers 90% of use cases.

### Deployment Target
Decision factors: team size, ops experience, scale needs.

| Context | Recommendation | Reason |
|---------|---------------|--------|
| Solo dev / MVP | Docker Compose | Simple, reproducible |
| Small team, cloud | Cloud managed (Railway, Vercel, Fly.io) | Zero ops burden |
| Medium team | Docker + CI/CD | Control without complexity |
| Large team / enterprise | Kubernetes | Full orchestration |
| Desktop/CLI tool | Local only | No deployment needed |

Default: **Docker** — good balance of simplicity and portability.

### API Style
Decision factors: consumer type, data patterns, performance needs.

| Consumer | Recommendation | Reason |
|---------|---------------|--------|
| Web/mobile frontend | REST | Simple, well-understood, cacheable |
| Multiple frontends with varying data needs | GraphQL | Flexible queries, less over-fetching |
| Service-to-service (internal) | gRPC | Fast, typed contracts, streaming |
| Background processing | Async Messaging | Decoupled, resilient |

Default: **REST** — lowest friction, most tooling.

### Authentication
Decision factors: user type, app type.

| User Type | Recommendation | Reason |
|-----------|---------------|--------|
| No users (internal tool) | API Key or None | Simplest |
| Internal employees | SSO / OAuth2 | Centralized identity |
| Public users (B2C) | OAuth2/OIDC | Social login, standards-based |
| API consumers (B2B) | API Key + JWT | Programmatic access |
| Mobile app | OAuth2 + PKCE | Secure mobile flow |

### Authorization Model
Decision factors: permission complexity.

| Complexity | Recommendation | Reason |
|-----------|---------------|--------|
| Simple (admin/user) | RBAC | Easy to implement and understand |
| Complex (resource-level) | ABAC | Fine-grained, policy-based |
| Very simple (all-or-nothing) | None | Don't over-engineer |

Default: **RBAC** — covers most cases.

### Data Access Pattern
Decision factors: language, framework, query complexity.

| Stack | Recommendation | Reason |
|-------|---------------|--------|
| Node.js/TS | Prisma | Type-safe, great DX, migrations |
| Java/Spring | JPA/Hibernate | Standard, mature |
| .NET | EF Core | First-party, well-integrated |
| Go | sqlx | Lightweight, close to SQL |
| Python/Django | Django ORM | Built-in |
| Python/FastAPI | SQLAlchemy | Flexible, mature |
| Complex queries needed | Raw SQL | Full control |

### Error Model
Decision factors: API style, consumer expectations.

| API Style | Recommendation | Reason |
|-----------|---------------|--------|
| REST (public) | RFC 7807 | Industry standard, well-tooled |
| REST (internal) | Standard wrapper | Simpler, consistent |
| GraphQL | GraphQL errors spec | Built into the protocol |
| gRPC | gRPC status codes | Built into the protocol |

### Hosting (Frontend)
Decision factors: SEO needs, interactivity level.

| Need | Recommendation | Reason |
|------|---------------|--------|
| SEO important (blog, e-commerce) | SSR (Next.js on Node/Vercel) | Server-rendered for crawlers |
| Dashboard / internal app | Static SPA on CDN | Fast, cheap, simple |
| Hybrid | SSR with static pages | Best of both worlds |

### Message Broker
Decision factors: throughput, ordering needs, existing infrastructure.

| Scale | Recommendation | Reason |
|-------|---------------|--------|
| Simple task queue | RabbitMQ or Redis | Easy setup, good for job queues |
| High throughput / event log | Kafka | Durable, replayable, scalable |
| Cloud-native / serverless | SQS/PubSub | Managed, no ops |

### Testing Strategy
Decision factors: project maturity, risk tolerance.

| Stage | Recommendation | Coverage |
|-------|---------------|---------|
| MVP / prototype | Unit only | 60-70% |
| Production app | Unit + Integration | 80% |
| Critical system / payments | Unit + Integration + E2E | 85-90% |
| Library / public API | Unit + Contract tests | 90% |

### Observability
Decision factors: environment, debugging needs.

| Environment | Recommendation |
|------------|---------------|
| Local development | Logs only |
| Staging / pre-prod | Logs + Metrics |
| Production | Logs + Metrics + Tracing |

### Scalability
Decision factors: expected user count.

| Users | Recommendation |
|-------|---------------|
| < 1,000 | Single node |
| 1,000 – 100,000 | Horizontal scale |
| 100,000+ or global | Multi-region |

### Config / Secrets Management
Decision factors: deployment target, security needs.

| Deployment | Recommendation |
|-----------|---------------|
| Local / Docker Compose | Environment variables |
| Cloud managed | Cloud Secrets Manager (e.g., AWS SSM, GCP Secret Manager) |
| Enterprise / multi-env | HashiCorp Vault |

---

## Full-Stack Package Recommendations

When the user asks the agent to decide everything ("you choose", "decide the whole stack"), present a complete recommended stack based on app type. Use data from Phase 1a (project name, purpose, app type).

### Backend API (small–medium)
```
Language:     Node.js + TypeScript
Framework:    Express + tsoa
Architecture: Layered
Database:     PostgreSQL
ORM:          Prisma
API:          REST
Auth:         JWT
Deploy:       Docker
Testing:      Unit + Integration (80%)
```

### Full-stack (SaaS / web app)
```
Language:     TypeScript
Framework:    Next.js (App Router)
Architecture: Layered
Database:     PostgreSQL
ORM:          Prisma
API:          REST (tRPC optional)
Auth:         NextAuth.js (OAuth2)
Deploy:       Docker / Vercel
Testing:      Unit + Integration + E2E (80%)
```

### Mobile App
```
Language:     TypeScript
Framework:    React Native / Expo
Architecture: Layered
Backend:      Firebase or custom API
Auth:         OAuth2 + PKCE
Deploy:       App Store + Google Play
Testing:      Unit + E2E (70%)
```

### CLI Tool
```
Language:     Go
Framework:    Cobra
Architecture: Layered
Data:         SQLite (if needed)
Distribution: Single binary (goreleaser)
Testing:      Unit (80%)
```

### Worker / Batch
```
Language:     Python
Framework:    Celery + Redis
Architecture: Layered
Database:     PostgreSQL
Trigger:      Queue or Cron
Retry:        Exponential backoff
Testing:      Unit + Integration (80%)
```

After presenting the package, ask: "Does this work for you, or would you like to change any part?"
If the user wants to change specific parts, switch to per-question mode for those items only.
