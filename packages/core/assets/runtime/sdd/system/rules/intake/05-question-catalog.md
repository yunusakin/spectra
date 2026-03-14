# Intake Question Catalog

Stable IDs for intake questions. Use these IDs in `sdd/memory-bank/core/intake-state.md` decision records.

## Core Questions

| Question ID | Field | Prompt |
|---|---|---|
| Q-CORE-001 | Project name | What is the project name? |
| Q-CORE-002 | Purpose | What is the primary purpose/goal? |
| Q-CORE-003 | App type | Which app type are we building? |

## Technical Mandatory Questions

| Question ID | Field | Prompt |
|---|---|---|
| Q-TECH-001 | Primary language + version | What language and version will we use? |
| Q-TECH-002 | Framework + version | What framework and version will we use (or none)? |
| Q-TECH-003 | Architecture style | Which architecture style will we use? |
| Q-TECH-004 | Primary data store + version | What is the primary datastore and version (or none)? |
| Q-TECH-005 | Deployment target | Where will we deploy? |
| Q-TECH-006 | API style | Which API style will we use? |

## Extension IDs
Use this prefixing scheme for additional questions:
- `Q-TYPE-*` for app-type specific follow-ups
- `Q-API-*` for API-style follow-ups
- `Q-ADV-*` for advanced optional questions

## Rules
- Do not change existing IDs after use.
- If wording changes, keep the same ID when semantics are unchanged.
- If semantics change, create a new ID.
