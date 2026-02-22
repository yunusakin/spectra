# Release Summary

## v1.0.2

### Feature: Token-Efficient Intake Context
- Split the large intake question corpus into phase/app-type packs under `sdd/.agent/rules/intake/questions/`.
- Converted `sdd/.agent/rules/intake/01-questions.md` into a router instead of a full question payload.
- Added `sdd/.agent/runtime/minimal.md` to enforce minimal context loading by workflow mode.
- Updated intake flow and adapter contracts to load only required packs per phase.

### Feature: Skill Graph Enforcement
- Added canonical dependency map `sdd/.agent/skills/dependency-map.tsv`.
- Added `scripts/resolve-skills.sh` for task-type skill ordering and validation.
- Added `sdd/memory-bank/core/skill-runs.md` for skill execution traceability.
- Enforced hard-fail policy checks for dependency order and required edges on `app/*` ranges.

### Operational Outcome
- Reduced intake context payload size by replacing one large question file with selective pack loading.
- Kept strict policy and validation guardrails active while lowering token overhead.
