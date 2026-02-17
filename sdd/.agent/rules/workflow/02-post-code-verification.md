# Post-Code Verification (Mandatory)

After generating or modifying application code under `app/`, the agent MUST run these checks before marking the task as done.

## Verification Checklist

### 1. Build Check
- [ ] The code compiles / builds without errors.
- [ ] No new linter warnings were introduced (if a linter is configured).

### 2. Test Check
- [ ] Existing tests still pass.
- [ ] New functionality has corresponding tests (unit at minimum).
- [ ] If tests fail, fix the code before proceeding — do not skip.

### 3. Spec Alignment
- [ ] The implemented behavior matches the requirements in `sdd/memory-bank/core/projectbrief.md`.
- [ ] If the implementation deviates from specs, follow the discovery protocol in `00-spec-lifecycle.md` (do not silently deviate).

### 4. Traceability
- [ ] Update `sdd/memory-bank/core/traceability.md` with the code location and test location for each implemented requirement.

### 5. Progress
- [ ] Update `sdd/memory-bank/core/progress.md`.
- [ ] Update `sdd/memory-bank/core/activeContext.md` (Recent Changes).

## When a Check Fails
1. Stop and fix the issue.
2. Re-run the failed check.
3. If the fix requires a spec change, follow the discovery protocol.
4. Only mark the task as done when all checks pass.
