# Post-Code Verification (Mandatory)

After modifying application code under `app/`, run all checks below before marking done.

## Verification Checklist

### 1. Build Check
- [ ] Code compiles/builds.
- [ ] No new lint/type warnings (if configured).

### 2. Test Check
- [ ] Existing tests pass.
- [ ] New behavior has corresponding tests.
- [ ] Failing tests are fixed before continuation.

### 3. Spec Alignment
- [ ] Behavior matches `sdd/memory-bank/core/projectbrief.md` and related specs.
- [ ] Deviations are resolved via `00-spec-lifecycle.md`.

### 4. Role Gate Alignment
- [ ] Validation findings recorded in `sdd/memory-bank/core/review-gate.md`.
- [ ] Challenge findings recorded in `sdd/memory-bank/core/review-gate.md`.
- [ ] No unresolved `critical` or `warning` findings remain.

### 5. Traceability
- [ ] Update `sdd/memory-bank/core/traceability.md` with code + test references.

### 6. Progress
- [ ] Update `sdd/memory-bank/core/progress.md`.
- [ ] Update `sdd/memory-bank/core/activeContext.md`.

## When a Check Fails
1. Stop and fix the issue.
2. Re-run failed checks.
3. If fix requires spec change, follow `00-spec-lifecycle.md`.
4. If blocked after repeated attempts, escalate per `04-escalation-policy.md`.
