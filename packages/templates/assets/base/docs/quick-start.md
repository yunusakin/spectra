## Quick Start

1. Install Spectra in your project:

```bash
npx spectra init /path/to/your-project

# Optional adapters:
npx spectra init /path/to/your-project --agents claude,cursor,windsurf,copilot,codex,antigravity

# Optional brownfield discovery:
npx spectra adopt /path/to/your-project
```

2. Resolve bootstrap context:

```bash
spectra ctx --role planner --goal discover
```

Legacy alias: `spectra ctx --task bootstrap`

3. Type `init`.
   This is a chat/runtime message, not a shell command.
4. Answer Phase 1 (Core) questions.
5. For technical choices, confirm recommendations before persistence.
6. Ensure `sdd/memory-bank/core/intake-state.md` has:
   - `Decision Log` entries for confirmed choices
   - no unresolved blockers before approval
7. Run checks:

```bash
spectra val
```

8. When specs are correct and checks pass, advance the staged approvals:

```bash
spectra ap --stage product-approved
spectra ap --stage technical-approved
spectra ap --stage implementation-approved
```

9. Before implementation work, write an implementation brief:

```bash
spectra task --item TASK-001 --task-type bugfix --goal "Describe intended change"
```

10. After `implementation-approved`, Spectra scaffolds under `app/` and starts sprint execution.

## Open Question Workflow

If a technical question is unresolved:
1. Add it to `Open Technical Questions` with status `open`.
2. Attach an issue reference.
3. Resolve and set status to `resolved`.
4. Re-run policy checks.

Health check anytime:

```bash
spectra st
```
