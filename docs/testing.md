# Testing and Quality Checks

This repository is a spec-driven backbone, so "tests" here focus on validating internal consistency between rules, indexes, and templates.

## Automated Validation
Run:

```bash
python3 scripts/validate-repo.py
```

This checks:
- Broken references in rule/spec/prompt indexes
- Adapter consistency (`AGENT.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`)
- Skills front matter and index coverage
- Basic markdown template expectations for `sdd/memory-bank/`

## Manual Intake Flow Scenarios
Use these as regression scenarios when editing intake rules.

1. Phase 1 only (Core)
   - Use any example in `docs/examples/`.
   - Expect: Phase 1 files updated and validation passes for mandatory fields.

2. Resume after interruption
   - Start `init`, answer only Phase 1a.
   - Stop, then run `init` again.
   - Expect: agent resumes using `sdd/memory-bank/core/intake-state.md` and asks only missing mandatory answers.

3. Inconsistent answers
   - Answer: `Framework: None` but `Framework version: 3.2`.
   - Expect: validation fails and agent asks a targeted follow-up.

4. Async messaging API style
   - Pick `API style: Async Messaging`.
   - Expect: Phase 2b asks broker + delivery semantics, or the user explicitly skips with justification.

5. Full-stack
   - Pick `App type: Full-stack`.
   - Expect: follow-ups for both backend and web (or explicit skip) before approval.

