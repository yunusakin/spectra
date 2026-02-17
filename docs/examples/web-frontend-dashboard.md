# Example: Web Frontend (Dashboard App)

Use this as a reference for answering `init` prompts.

## Phase 1 (Core) Answers
- Project name: Analytics Dashboard
- Primary purpose/goal: Real-time analytics dashboard for monitoring business KPIs.
- App type: Web Frontend
- Primary language: TypeScript
- Language version: 5.3
- Framework: Next.js
- Framework version: 14
- Architecture style: Component-based
- Primary data store: None (consumes API)
- Deployment target: Vercel
- API style: REST (consuming external API)

## Phase 2 (Type-Specific) Answers: Web Frontend
- Primary users: Internal analytics team
- Domain/problem summary: Business analysts need real-time visibility into revenue, orders, and user engagement metrics.
- Key entities: Dashboard, Widget, Chart, Filter, DateRange
- Must-have features:
  - Real-time KPI cards with auto-refresh
  - Interactive charts (line, bar, pie)
  - Date range filtering
  - Export to CSV/PDF
  - Responsive layout (desktop + tablet)
- Authentication: SSO via company IdP
- State management: React Server Components + client hooks
- Styling approach: CSS Modules
- Key pages / routes:
  - `/` — main dashboard
  - `/reports` — saved reports
  - `/settings` — user preferences
  - `/login` — auth redirect

## Phase 3 (Advanced, Optional) Answers
- Non-goals/exclusions: No mobile app; no data ingestion pipeline.
- Performance targets: First Contentful Paint < 1.5s
- Accessibility: WCAG 2.1 AA
- Testing strategy: Unit (Vitest) + E2E (Playwright)
- Environments: Dev + Preview + Prod

## What You Should See Updated
- `sdd/memory-bank/core/projectbrief.md` (name, purpose, app type, requirements)
- `sdd/memory-bank/tech/stack.md` (TypeScript/Next.js)
- `sdd/memory-bank/arch/patterns-overview.md` (component-based)
