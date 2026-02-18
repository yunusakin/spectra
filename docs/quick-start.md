## Quick Start

1. Install Spectra in your project:

```bash
# From within the Spectra repo:
./scripts/init.sh /path/to/your-project

# Or download and install directly:
bash <(curl -sL https://raw.githubusercontent.com/yunusakin/spectra/main/scripts/init.sh)
```

2. Open your project in your AI agent.
3. Type `init`.
4. Answer Phase 1 (Core) questions.
5. For technical choices, confirm recommendations before persistence.
6. Ensure `sdd/memory-bank/core/intake-state.md` has:
   - `Decision Log` entries for confirmed choices
   - no unresolved blockers before approval
7. Run checks:

```bash
bash scripts/validate-repo.sh --strict
bash scripts/check-policy.sh
```

8. When specs are correct and checks pass, reply `approved`.
9. After `approved`, the agent scaffolds under `app/` and starts sprint execution.

## Open Question Workflow

If a technical question is unresolved:
1. Add it to `Open Technical Questions` with status `open`.
2. Attach an issue reference.
3. Resolve and set status to `resolved`.
4. Re-run policy checks.

Health check anytime:

```bash
bash scripts/health-check.sh
```
