# Web Frontend Scaffold

## Target Structure

Create this tree under `app/`:

```
app/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page-level components / routes
│   ├── hooks/           # Custom hooks (React) or composables (Vue)
│   ├── services/        # API client, data fetching
│   ├── styles/          # Global styles, design tokens
│   ├── utils/           # Shared utilities
│   └── main.*           # Entry point
├── public/
│   ├── index.html       # HTML shell
│   └── favicon.ico      # Placeholder
├── tests/
│   ├── unit/            # Component unit tests
│   └── e2e/             # End-to-end tests (if applicable)
├── .env.example         # Environment variable template
├── .gitignore           # Framework-specific ignores
├── README.md            # Project README
└── package.json         # Dependencies
```

## Step-by-Step

1. Read intake answers from `sdd/memory-bank/tech/stack.md` for framework.
2. Create the directory tree under `app/`.
3. Generate the entry point with a minimal "Hello" page.
4. Generate `.env.example` with `VITE_API_URL` or equivalent.
5. Generate `package.json` with the framework, build tool, and test runner.
6. Generate `.gitignore` for the framework.
7. Generate `README.md` with setup, dev, and build commands.
8. Confirm the dev server starts and renders the hello page.

## Customization Notes

- **React (Vite)**: Use Vite conventions. Entry: `src/main.tsx`.
- **Next.js**: Use `app/` router or `pages/` router based on version.
- **Vue**: Use `src/App.vue` entry with Vite.
- **Svelte**: Use `src/routes/` for SvelteKit.
