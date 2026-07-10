# Progress

> Auto-maintained by the agent.
>
> This file is project-bound: it tracks execution progress for the target application built with Spectra.

## Project Binding
- Project Name: `<target-project-name>`
- Project Root: `<absolute-target-project-path>`
- Repository: `<owner/repo or local>`
- Branch: `<current-branch>`
- Sprint/Iteration: `<sprint-id>`

## Progress Summary
- Overall Status: `on-track|at-risk|blocked`
- Completion: `<0-100%>`
- Current Milestone: `<milestone>`
- Next Milestone: `<milestone>`

## Work Log
| Date | Item ID | Area | Change | Status | Evidence |
|------|---------|------|--------|--------|----------|
| YYYY-MM-DD | `<id>` | `<area>` | `<summary>` | `<done|in-progress|blocked>` | `<path or command>` |

## Completed
| Item ID | Description | Specs Updated | Code/Test Links | Done Date |
|---------|-------------|---------------|-----------------|-----------|
| - | - | - | - | - |

## In Progress
| Item ID | Description | Owner | Blockers | Next Checkpoint |
|---------|-------------|-------|----------|-----------------|
| - | - | - | - | - |

## Blocked
| Item ID | Blocker | Decision Needed | Owner | ETA |
|---------|---------|-----------------|-------|-----|
| - | - | - | - | - |

## Next Actions
1. Complete the current in-progress item.
2. Run required validation and policy checks.
3. Update this file at the end of the next significant task.

## Validation Snapshot
- `validate-repo.sh --strict`: `<pending|ok|fail>`
- `check-policy.sh`: `<pending|ok|fail>`
- tests/build: `<pending|ok|fail|n/a>`

## Session Boundary
- Last Updated: `<YYYY-MM-DD>`
- Resume From: `<step>`
- Handoff Notes: `<important context>`
