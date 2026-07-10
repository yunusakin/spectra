# Spectra Plan-Gap Hardening Design

## Goal

Close the correctness gaps found in the Lite/Full architecture review without changing the established `spectra/` boundary or public command model.

## Design

- Native self-update resolves the newly installed executable from `SPECTRA_BIN` or `$HOME/.local/bin` and never depends on `spectra` already being on `PATH`.
- Update refreshes or migrates the runtime, then runs the same profile-aware project check exposed by `spectra check`.
- Migration performs a complete conflict preflight before its first filesystem move. Local Git migration removes only known legacy Spectra exclusions and installs `/spectra/`; shared mode leaves Git exclusions unchanged.
- Status combines working-tree paths, paths from the latest Git commit, nested Markdown changes, and the three meaningful resume files. Untouched generated templates are not reported as recent work.
- Help detects an installed profile when possible. Lite identifies itself and stays focused on core commands; Full additionally points users to advanced help. Outside a project, help remains profile-neutral.

## Error Handling

- Failed migration preflight leaves the source layout unchanged.
- A failed post-update check makes update return a nonzero status after clearly reporting that files were updated but validation failed.
- Native update reports the exact executable it could not invoke.

## Testing

- Add isolated tests for atomic migration conflicts, local exclusion replacement, shared-mode preservation, post-migration check execution, native executable resolution, recent committed status paths, untouched-template suppression, and Lite/Full help output.
- Run focused tests first, then the complete CLI suite, version parity, diff checks, and native smoke tests.

## Scope

Reducing the Lite asset inventory is intentionally separate. This hardening pass fixes correctness and safety without deleting runtime context that existing Lite behavior may depend on.
