# Scaffolding Guide

After approval, the agent uses a scaffolding template to create a consistent project skeleton under `app/`.

## How It Works

1. Read `sdd/memory-bank/core/projectbrief.md` → get the **App Type**.
2. Navigate to the matching scaffold directory below.
3. Read `scaffold.md` inside that directory for step-by-step instructions.
4. Create the directory tree and boilerplate files under `app/`.
5. Customize the boilerplate based on intake answers (language, framework, data store).

## Available Scaffolds

| App Type | Scaffold |
|---|---|
| Backend API | `sdd/.agent/scaffolds/backend-api/scaffold.md` |
| Web (frontend) | `sdd/.agent/scaffolds/web-frontend/scaffold.md` |
| Full-stack | `sdd/.agent/scaffolds/full-stack/scaffold.md` |
| CLI | `sdd/.agent/scaffolds/cli/scaffold.md` |
| Worker/Batch | `sdd/.agent/scaffolds/worker/scaffold.md` |

If the user's app type doesn't have a scaffold, use `backend-api` as a starting point and adapt.

## After Scaffolding

- Confirm the project builds/runs (even if it only prints "Hello").
- Update `activeContext.md` with the scaffold that was used.
- Move to the sprint execution loop.
