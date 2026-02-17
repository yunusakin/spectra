# Agent Memory (Reserved)

This directory is reserved for future agent session-state persistence (e.g., conversation summaries, cross-session context handoff).

Currently, all active state is managed through:
- `sdd/memory-bank/core/intake-state.md` — intake progress and resume data
- `sdd/memory-bank/core/progress.md` — ongoing task tracking
- `sdd/memory-bank/core/activeContext.md` — current working context

Do not add files here unless a new session-state mechanism is formally defined.
