# Backend API Scaffold

## Target Structure

Create this tree under `app/`:

```
app/
├── src/
│   ├── config/          # App configuration, env loading
│   ├── routes/          # Route/controller definitions
│   ├── services/        # Business logic
│   ├── models/          # Data models / entities
│   ├── middleware/       # Auth, logging, error handling
│   ├── utils/           # Shared utilities
│   └── index.*          # Entry point
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── migrations/          # Database migrations (if data store selected)
├── infra/
│   ├── Dockerfile       # Container build
│   └── docker-compose.yml  # Local dev stack
├── .env.example         # Environment variable template
├── .gitignore           # Language-specific ignores
├── README.md            # Project README (auto-generated)
└── package.json / pom.xml / go.mod / etc.  # Dependency manifest
```

## Step-by-Step

1. Read intake answers from `sdd/memory-bank/tech/stack.md` for language, framework, and data store.
2. Create the directory tree shown above under `app/`.
3. Generate the entry point file (`src/index.*`) with a minimal health-check endpoint.
4. Generate `.env.example` with placeholders for:
   - `PORT` (default: 3000 or 8080)
   - `DATABASE_URL` (if data store selected)
   - `NODE_ENV` / equivalent
5. Generate `.gitignore` appropriate to the language.
6. Generate `README.md` with project name, setup instructions, and run commands.
7. Generate the dependency manifest with the framework and test runner.
8. If a data store was selected, create an initial migration (empty or hello-world schema).
9. If Docker deployment was selected, generate `Dockerfile` and `docker-compose.yml`.
10. Confirm the project builds and the health-check endpoint responds.

## Customization Notes

- **Spring Boot**: Use `src/main/java/...` and `src/test/java/...` instead of flat `src/` and `tests/`.
- **Go**: Use `cmd/`, `internal/`, `pkg/` layout if the user prefers standard Go project layout.
- **Python**: Use `src/{project_name}/` or flat layout depending on framework.
- Adapt the structure to match the framework's conventions — don't fight it.
