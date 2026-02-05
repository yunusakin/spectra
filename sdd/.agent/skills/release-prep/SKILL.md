---
name: release-prep
description: Prepare a release with changelog and release summary updates. Use before tagging or deploying.
---

# Release Prep

## Purpose
Ensure release artifacts and notes are complete before deployment.

## Inputs
- Change list since last release
- Known risks or breaking changes
- Deployment target and window

## Steps
1. Update `CHANGELOG.md` with notable changes.
2. Update `RELEASE_SUMMARY.md` with highlights and risks.
3. Verify migrations and compatibility notes.
4. Confirm test and QA status.
5. Document rollback plan and monitoring checks.

## Outputs
- Updated release documentation
- Release readiness checklist

## Checklist
- [ ] CHANGELOG updated
- [ ] RELEASE_SUMMARY updated
- [ ] Migration notes included
- [ ] QA status confirmed
- [ ] Rollback plan documented

## Example Input
- Changes: new orders API, DB migration, UI updates

## Example Output
- CHANGELOG updated with breaking change note
- RELEASE_SUMMARY includes migration steps

