# Example: Worker/Batch (Billing Reconciler)

Use this scenario to shape the core executable spec bundle created by `spectra init` or `spectra adopt`.

## Phase 1 (Core) Answers
- Project name: Billing Reconciler Worker
- Primary purpose/goal: Reconcile invoices nightly and publish discrepancies to a queue.
- App type: Worker/Batch
- Primary language: Python
- Language version: 3.12
- Framework: None
- Framework version: none
- Architecture style: Event-Driven
- Primary data store: PostgreSQL
- Data store version: 16
- Deployment target: Kubernetes
- API style: Async Messaging

## Phase 2 (Type-Specific) Answers: Worker/Batch
- Trigger type: Schedule (cron)
- Schedule/throughput expectation: Nightly at 02:00 UTC; up to 1M invoices.
- Concurrency model: Parallel workers
- Retry/backoff: Exponential backoff
- Idempotency requirement: Required
- Failure handling: DLQ
- State storage: Database
- Observability expectations: Logs+Metrics

## Phase 2b (API-Style) Answers: Async Messaging
- Broker: Kafka
- Delivery semantics: At-least-once

## Phase 3 (Advanced, Optional) Answers (Example)
- Availability requirement: Best effort
- Config/secrets management: Env vars
- Compliance/security constraints: PII

## What You Should See Created
- `sdd/features/billing-reconcile/feature.spec.yaml` for reconciliation behavior and acceptance
- `sdd/features/billing-reconcile/technical-decisions.yaml` for event-driven processing, retries, and idempotency
- `sdd/features/billing-reconcile/telemetry-contract.yaml` for throughput, discrepancy, and failure signals
- `sdd/governance/approval-state.yaml` for staged approval progress
