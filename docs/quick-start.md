## Quick Start

1. Install Spectra in your project:

```bash
# From within the Spectra repo:
./scripts/init.sh /path/to/your-project

# Or download and install directly:
bash <(curl -sL https://raw.githubusercontent.com/yunusakin/spectra/main/scripts/init.sh)
```

2. The script copies all files and optionally asks 3 basic questions (name, purpose, app type).
3. Open your project in your AI agent (Cursor, VS Code, etc.).
4. Type `init`.
5. Answer Phase 1 (Core) questions. If unsure about any technical question, say **"recommend"** — the agent will suggest the best option for your project.
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
