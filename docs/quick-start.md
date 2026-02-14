## Quick Start

1. Clone this repository.
2. Open your AI agent in the repository root.
3. (Optional) Review `docs/examples/` for intake answer patterns.
4. Type `init`.
5. Answer Phase 1 (Core) questions.
6. Continue Phase 2 / 2b questions relevant to your app type and API style.
7. Optionally continue or skip Phase 3 (advanced).
8. Review generated specs under `sdd/memory-bank/`.
9. Run validation:

```bash
bash scripts/validate-repo.sh --strict
```

10. When specs are correct and validation passes, reply `approved`.
11. After `approved`, the agent scaffolds under `app/` and starts the sprint loop.

Health check anytime:

```bash
bash scripts/health-check.sh
```
