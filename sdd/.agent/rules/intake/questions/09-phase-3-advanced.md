# Intake Questions: Phase 3 Advanced

Ask in small batches (<= 10 questions per turn). Offer to skip Phase 3 entirely after Phase 2.

## Phase 3a: Product / NFR Targets
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

## Phase 3b: Quality / Delivery / Compliance
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
