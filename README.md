# SDD Spine

SDD Spine is a spec-driven development backbone that keeps project structure stable while working with AI agents or human-driven workflows.

## Getting Started
1. Pick your agent adapter file:
   - Codex: `AGENTS.md`
   - Claude: `CLAUDE.md`
   - Cursor: `.cursorrules`
   - Other tools: `AGENT.md`
2. Open your agent in the repo root and type `init`.
3. Answer the intake questions in phases. The agent will:
   - write specs under `sdd/memory-bank/`
   - track progress in `sdd/memory-bank/core/intake-state.md`
   - validate checkpoints (`sdd/.agent/rules/intake/02-validation.md`)
4. Fix any validation errors the agent reports.
5. Reply `approved`. After approval, all application code must be generated under `app/` only.

Example intake answers (Phase 1):
- Project name: Customer Orders Service
- Primary purpose/goal: Manage customer orders, payments, and shipment status.
- App type: Backend API
- Primary language + version: Java 21
- Framework + version: Spring Boot 3.2
- Architecture style: Hexagonal
- Primary data store + version: PostgreSQL 16
- Deployment target: Kubernetes
- API style: REST

If you stop mid-intake, re-run `init` later. The agent should resume using `sdd/memory-bank/core/intake-state.md`.

If requirements change after approval, update specs first, record the change in `sdd/memory-bank/core/spec-history.md`, and re-approve when required (see `docs/workflow.md`).

## Goals
- Stable, spec-first workflow across projects
- Clear separation of specs and application code
- Agent-agnostic intake and approval gates

## Vision
Ship reliable software by making specs the source of truth and keeping structure consistent across teams and tools.

## Problem It Solves
Many projects drift because requirements, architecture, and code live in different places and evolve out of sync. This gets worse when multiple AI agents or tools produce changes without a shared spec source of truth. SDD Spine enforces a clear spec-first flow and a stable repo structure so teams can move fast without losing clarity.

## How It Works
1. Intake captures purpose, constraints, and technical choices for humans and AI agents.
2. Specs live under `sdd/memory-bank/` and are updated before code.
3. Approval gates prevent premature coding.
4. All application code stays under `app/`.

## AI Agents
SDD Spine is designed for multi-agent workflows where different tools may generate or modify code.

## Agent Expectations
- Start with `init` and complete intake before coding.
- Read rules under `sdd/.agent/`.
- Write specs under `sdd/memory-bank/` before implementation.
- Generate application code only under `app/`.
- Stop for approval before producing code.

## Supported Agents
- Any LLM-based agent that can read files, follow intake, and respect the approval gate.
- The repo includes adapters for Codex, Cursor, Claude, and generic tooling.

## Customizing for Your Agent
Developers can tailor the structure and prompts to a specific agent by updating the adapter files and rules under `sdd/.agent/`. You can add agent-specific instructions, tweak intake flow, or extend skills to match how your team works.

## Folder Structure
- `sdd/` spec rules, memory bank, and process artifacts
- `app/` application code only (generated after approval)
- `docs/` project documentation
- `scripts/` helper scripts

**Note:** This repository includes `app/README.md` as a placeholder and structure guide. Agents must still wait for explicit approval before generating any application code. After approval, all application code lives under `app/` only.

## Use Cases
- Starting a new project with a spec-first process
- Standardizing structure across multiple teams and repos
- Working with different AI agents while keeping outputs consistent
- Auditing decisions and requirements over time

## Non-Goals
- Replacing your existing framework or build system
- Enforcing a specific programming language or tech stack
- Shipping end-user features directly

## Docs
- `docs/getting-started.md`: Full workflow with Mermaid diagram.
- `docs/quick-start.md`: Concise step-by-step intake + approval flow.
- See `docs/examples/` for copy-pasteable example intake answers and scenarios.
- See `docs/workflow.md` for spec change, re-approval, and rollback guidance.
- See `docs/testing.md` for repo validation and intake regression scenarios.

## Roadmap
- Add templates for common project types
- Provide reusable checklists for reviews and releases
- Expand skills for API design, testing, and security workflows
- Add example reference implementations under `app/`

## Contributing
- Open an issue describing the change and motivation.
- Keep spec updates in `sdd/` aligned with code changes.
- Prefer small, focused PRs with clear scope.

## Entry Files for Agents
- `AGENT.md` (generic adapter)
- `AGENTS.md` (Codex adapter)
- `CLAUDE.md` (Claude adapter)
- `.cursorrules` (Cursor adapter)
