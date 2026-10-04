# Unresolved Business Rules: spectra-product

## RULE-SPE-011 — Legacy `approved` approval status

The policy script `check-policy.sh` accepts the legacy value `approved` as an implementation-approval status, but `spectra approve` writes only the staged vocabulary and `STAGES` has no `approved` stage. Whether the legacy value remains a supported way to pass the approval gate has not been decided.

Status: unresolved
Affected Modules: packages-cli, packages-core
Evidence: packages/core/assets/runtime/scripts/check-policy.sh lines 578-585; packages/cli/src/lib/specs/stages.js
Confidence: low
