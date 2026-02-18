# Intake Questions (Progressive)

The intake is designed to be run in phases:
- Phase 1 (Core, required): ask only the mandatory questions.
- Phase 2 (Type-specific, recommended): ask only the follow-ups relevant to the chosen App Type.
- Phase 2b (API-style, recommended): ask only the follow-ups relevant to the chosen API style (if applicable).
- Phase 3 (Advanced, optional): quality, security, ops, and non-functional targets.

Users can answer in a single message using bullets.

## Question Contract Requirement
For technical questions, follow `04-question-contract.md` and use IDs from `05-question-catalog.md`.

- Do not persist technical choices before explicit confirmation.
- Record confirmed technical choices in `intake-state.md` -> `## Decision Log`.
- Record unresolved technical choices in `intake-state.md` -> `## Open Technical Questions`.

## Phase 1: Core (Required)
Ask in small batches (<= 10 questions per turn). If the user prefers, they can answer all Phase 1 questions at once.

### Phase 1a: Project Basics
1) [Q-CORE-001] Project name? (free text)
2) [Q-CORE-002] Primary purpose/goal? (free text)
3) [Q-CORE-003] App type?
   A) Backend API
   B) Web (frontend only)
   C) Full-stack
   D) Mobile
   E) CLI
   F) Worker/Batch
   G) Library/SDK
   H) Other

### Phase 1b: Language / Framework / Architecture
4) [Q-TECH-001] Primary language?
   A) Java
   B) .NET
   C) Go
   D) Node.js
   E) Python
   F) Other
5) [Q-TECH-001] Language version? (free text)
6) [Q-TECH-002] Framework?
   A) Spring Boot
   B) ASP.NET Core
   C) Gin/Fiber
   D) Express/Nest
   E) Django/FastAPI
   F) None
   G) Other
7) [Q-TECH-002] Framework version? (free text, or "none")
8) [Q-TECH-003] Architecture style?
   A) Layered
   B) Hexagonal
   C) CQRS
   D) Microservices
   E) Event-Driven
   F) Other

### Phase 1c: Data / Deployment / API Style
9) [Q-TECH-004] Primary data store?
   A) PostgreSQL
   B) MySQL
   C) SQL Server
   D) MongoDB
   E) SQLite
   F) None
   G) Other
10) [Q-TECH-004] Data store version? (free text, or "none")
11) [Q-TECH-005] Deployment target?
   A) Local only
   B) Docker
   C) Kubernetes
   D) Cloud managed
   E) On-prem
   F) Other
12) [Q-TECH-006] API style?
   A) REST
   B) GraphQL
   C) gRPC
   D) Async Messaging
   E) Other

## Phase 2: Type-Specific Follow-ups (Recommended)
Ask only the section that matches the chosen App Type.

### Backend API / Full-stack (backend)
1) Primary users?
   A) Internal
   B) External B2B
   C) Public
   D) Other
2) Domain/problem summary? (free text)
3) Key entities (top 3-5)? (free text)
4) Must-have features (top 3-5)? (free text)
5) Authentication?
   A) None
   B) JWT
   C) OAuth2/OIDC
   D) SSO
   E) API Key
   F) Other
6) Authorization model?
   A) None
   B) RBAC
   C) ABAC
   D) Custom
   E) Other
7) Data access pattern?
   A) JPA/Hibernate
   B) EF Core
   C) SQLx/pgx
   D) Prisma
   E) Raw SQL
   F) Other
8) Error model / response envelope?
   A) RFC7807 errors only
   B) Standard success wrapper + errors
   C) No envelope
   D) Other
9) Key endpoints / operations (top 5)? (free text)
10) Async needs?
    A) None
    B) Domain events
    C) Background jobs
    D) Both
    E) Other

### Web (frontend only)
1) Target users?
   A) Internal
   B) External B2B
   C) Public
   D) Other
2) Core pages/routes (top 5-10)? (free text)
3) Target browsers/devices?
   A) Modern evergreen browsers
   B) Include Safari iOS
   C) Include legacy (old Edge/IE)
   D) Other
4) Hosting target?
   A) Static hosting (CDN)
   B) SSR (Node)
   C) App server
   D) Other
5) Authentication?
   A) None
   B) Cookie session
   C) OAuth2/OIDC
   D) SSO
   E) Other
6) Accessibility target?
   A) None
   B) WCAG AA
   C) WCAG AAA
   D) Other
7) Design system?
   A) Existing company DS
   B) Build lightweight DS
   C) Use component library
   D) Other
8) API dependencies (top 3)? (free text)

### Full-stack (frontend + backend)
Ask both sections: "Backend API / Full-stack (backend)" and "Web (frontend only)".

### Mobile (only if App Type = Mobile)
- Platform(s)? A) iOS B) Android C) Both D) Other
- Mobile framework? A) Native iOS B) Native Android C) Flutter D) React Native E) Other
- Minimum OS versions? (free text)
- App store distribution? A) App Store B) Google Play C) Enterprise/MDM D) Other
- Offline support? A) Yes B) No C) Other
- Push notifications? A) Yes B) No C) Other
- Device capabilities needed? A) Camera B) GPS C) Biometrics D) NFC E) Other

### CLI (only if App Type = CLI)
1) Primary users?
   A) Developers
   B) Operators/SRE
   C) End users
   D) Other
2) Supported OS?
   A) macOS
   B) Linux
   C) Windows
   D) Other
3) Command list (top 3-10)? (free text)
4) Output formats?
   A) Human-readable only
   B) JSON only
   C) Both
   D) Other
5) Configuration?
   A) Flags only
   B) Env vars
   C) Config file
   D) Combination
   E) Other
6) Distribution?
   A) Single binary
   B) Homebrew/apt/yum
   C) npm/pip
   D) Other
7) Exit code conventions? (free text)
8) Does it call external APIs/services?
   A) No
   B) Yes
   C) Other

### Worker/Batch (only if App Type = Worker/Batch)
1) Trigger type?
   A) Schedule (cron)
   B) Queue/message
   C) HTTP/Webhook
   D) Other
2) Schedule/throughput expectation? (free text)
3) Concurrency model?
   A) Single worker
   B) Parallel workers
   C) Auto-scale
   D) Other
4) Retry/backoff?
   A) None
   B) Fixed retries
   C) Exponential backoff
   D) Other
5) Idempotency requirement?
   A) Not needed
   B) Required
   C) Other
6) Failure handling?
   A) Stop on error
   B) Continue and report
   C) DLQ
   D) Other
7) State storage?
   A) None
   B) Database
   C) Object storage
   D) Other
8) Observability expectations?
   A) Logs only
   B) Logs+Metrics
   C) Logs+Metrics+Tracing
   D) Other

### Library/SDK (only if App Type = Library/SDK)
1) Target consumers?
   A) Internal teams
   B) External developers
   C) Both
   D) Other
2) Packaging/distribution?
   A) Maven/Gradle
   B) npm
   C) PyPI
   D) NuGet
   E) Other
3) Versioning policy?
   A) SemVer
   B) Calendar versioning
   C) Other
4) Backward compatibility expectations?
   A) Strict
   B) Best effort
   C) Breaking changes allowed early
   D) Other
5) Public API surface (main entry points)? (free text)
6) Example usage snippet needed?
   A) Yes
   B) No
   C) Other

## Phase 2b: API-Style Follow-ups (Recommended)
Ask only the section that matches the chosen API style (if applicable).

### REST
- Versioning strategy? A) URL (/v1) B) Header C) No versioning D) Other
- Pagination/filtering? A) Cursor B) Offset/limit C) Both D) Other

### GraphQL
- Schema ownership? A) Single team B) Federated C) Other
- Caching approach? A) None B) Persisted queries C) CDN caching D) Other

### gRPC
- Proto ownership? A) This repo B) Shared repo C) Other
- Streaming? A) None B) Server streaming C) Bi-di D) Other

### Async Messaging
- Broker? A) Kafka B) RabbitMQ C) SQS/PubSub D) Other
- Delivery semantics? A) At-most-once B) At-least-once C) Exactly-once D) Other

## Phase 3: Advanced (Optional)
Ask in small batches (<= 10 questions per turn). Offer to skip Phase 3 entirely after Phase 2.

### Phase 3a: Product / NFR Targets
1) Non-goals/exclusions? (free text)
2) Performance targets?
   A) None
   B) p95 latency goal
   C) Throughput goal
   D) Both
   E) Other
3) Scalability expectation?
   A) Single node
   B) Horizontal scale
   C) Multi-region
   D) Other
4) Availability requirement?
   A) Best effort
   B) 99.9%
   C) 99.99%
   D) Other
5) Observability baseline?
   A) Logs only
   B) Logs+Metrics
   C) Logs+Metrics+Tracing
   D) Other
6) Logging format?
   A) Plain text
   B) Structured JSON
   C) Other

### Phase 3b: Quality / Delivery / Compliance
7) Testing strategy?
   A) Unit only
   B) Unit+Integration
   C) +E2E
   D) Contract tests
   E) Other
8) Coverage target?
   A) 70%
   B) 80%
   C) 90%
   D) Other
9) CI/CD needs?
   A) None
   B) Basic (lint+test)
   C) Full pipeline
   D) Other
10) Environments?
    A) Dev only
    B) Dev+Stage
    C) Dev+Stage+Prod
    D) Other
11) Config/secrets management?
    A) Env vars
    B) Vault/Secrets Manager
    C) KMS/SSM
    D) Other
12) Compliance/security constraints?
    A) None
    B) PII
    C) GDPR
    D) HIPAA
    E) Other
13) Timeline/milestones? (free text)
14) Approval gate: confirm you will review the generated spec files before coding? (Yes/No)
