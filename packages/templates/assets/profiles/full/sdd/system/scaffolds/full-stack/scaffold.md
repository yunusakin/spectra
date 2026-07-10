# Full-Stack Scaffold

## Target Structure

Create this tree under `app/`:

```
app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middleware/
│   │   └── index.*
│   ├── tests/
│   ├── migrations/
│   └── package.json / pom.xml / go.mod
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── main.*
│   ├── public/
│   ├── tests/
│   └── package.json
├── shared/              # Optional: shared types/contracts
│   └── types/
├── infra/
│   ├── Dockerfile.backend
│   ├── Dockerfile.web
│   └── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Step-by-Step

1. Read intake answers from `sdd/memory-bank/tech/stack.md`.
2. Create both `backend/` and `web/` directories under `app/`.
3. Follow the backend-api scaffold for `backend/`.
4. Follow the web-frontend scaffold for `web/`.
5. If the backend and frontend share types, create `shared/types/`.
6. Generate a root `docker-compose.yml` that runs both services.
7. Generate a root `README.md` with setup instructions for the full stack.
8. Confirm both services start and the frontend can reach the backend health endpoint.
