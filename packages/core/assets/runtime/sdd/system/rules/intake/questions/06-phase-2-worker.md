# Intake Questions: Phase 2 Worker/Batch

Use when App Type is `Worker/Batch`.

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
