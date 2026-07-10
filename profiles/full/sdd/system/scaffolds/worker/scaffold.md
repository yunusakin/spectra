# Worker / Batch Scaffold

## Target Structure

Create this tree under `app/`:

```
app/
├── src/
│   ├── workers/         # Worker/job definitions
│   ├── processors/      # Message/event processors
│   ├── config/          # Config, queue connections
│   ├── utils/           # Shared utilities
│   └── main.*           # Entry point, worker bootstrap
├── tests/
│   ├── unit/
│   └── integration/
├── infra/
│   ├── Dockerfile
│   └── docker-compose.yml   # Worker + dependencies (queue, DB)
├── .env.example
├── .gitignore
├── README.md
└── package.json / go.mod / etc.
```

## Step-by-Step

1. Read intake answers from `sdd/memory-bank/tech/stack.md`.
2. Create the directory tree under `app/`.
3. Generate the entry point that starts a worker loop or message consumer.
4. Generate `.env.example` with queue/broker connection string, poll interval.
5. Generate a sample worker that logs "processing job" and exits cleanly.
6. Generate `docker-compose.yml` with the worker + its dependencies.
7. Confirm the worker starts, processes one dummy job, and shuts down cleanly.

## Customization Notes

- **Node.js**: Use `bullmq` (Redis) or `sqs-consumer` (AWS).
- **Python**: Use `celery` or `rq`.
- **Java**: Use Spring Batch or a plain `@Scheduled` consumer.
