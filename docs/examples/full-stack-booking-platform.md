# Example: Full-Stack (Booking Platform)

Use this as a reference for answering `init` prompts.

## Phase 1 (Core) Answers
- Project name: Room Booking Platform
- Primary purpose/goal: Internal room and desk booking system for a mid-size company.
- App type: Full-stack
- Primary language: TypeScript
- Language version: 5.3
- Framework: Next.js (frontend) + Express (API)
- Framework version: Next.js 14, Express 4.18
- Architecture style: Layered
- Primary data store: PostgreSQL
- Data store version: 16
- Deployment target: Docker Compose (self-hosted)
- API style: REST

## Phase 2 (Type-Specific) Answers: Full-Stack
- Primary users: Company employees + office managers
- Domain/problem summary: Employees book rooms/desks via a web UI. Managers configure availability and view usage reports.
- Key entities: User, Room, Desk, Booking, Floor, Building
- Must-have features:
  - Browse available rooms by date/time/floor
  - Book and cancel reservations
  - Calendar view of personal bookings
  - Admin panel for room/desk management
  - Usage reports (weekly, monthly)
- Authentication: Email/password + Google SSO
- Authorization model: Role-based (employee, manager, admin)

### Backend-Specific
- Data access pattern: Prisma ORM
- Error model: RFC7807
- Key endpoints:
  - `POST /api/bookings`
  - `GET /api/bookings?date=...&floor=...`
  - `DELETE /api/bookings/{id}`
  - `GET /api/rooms?available=true&date=...`
  - `GET /api/reports/usage`

### Frontend-Specific
- State management: React Server Components + SWR for client data
- Styling approach: Tailwind CSS
- Key pages:
  - `/` — floor map with availability
  - `/bookings` — personal booking list
  - `/admin/rooms` — room management
  - `/admin/reports` — usage reports

## Phase 3 (Advanced, Optional) Answers
- Non-goals/exclusions: No mobile app; no multi-building in v1.
- Performance targets: Page load < 2s on internal network
- Testing strategy: Unit (Vitest) + Integration (Supertest) + E2E (Playwright)
- Environments: Dev + Staging + Prod

## What You Should See Updated
- `sdd/memory-bank/core/projectbrief.md` (name, purpose, full-stack type, requirements)
- `sdd/memory-bank/tech/stack.md` (TypeScript/Next.js/Express/PostgreSQL)
- `sdd/memory-bank/arch/patterns-overview.md` (layered)
