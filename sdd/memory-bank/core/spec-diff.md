# Spec Diff Report

> Track spec deltas over time. Keep this file updated when specs change (especially before re-approval).
>
> Recommended workflow:
> - Initialize the baseline once (usually right after the first approval commit):
>   - `bash scripts/spec-diff.sh --init`
> - Append a new diff entry after changing specs:
>   - `bash scripts/spec-diff.sh --update`
>
> This file is designed to stay empty in the Spectra template and get populated in real projects.

<!--
Notes:
- The diff tool focuses on `sdd/memory-bank/` and ignores noisy state files by default.
- If your repo has no baseline yet, run `--init` once.
-->
