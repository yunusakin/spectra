# Agent Instructions

## Testing rules

- Never write unit tests after you write code.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex features work. At the end of E2E tests, produce a verifiable and repeatable artifact.
- If you must test a system in isolation, first write down all the ways it could fail, then write the code.

## Source repository layout

This repository is a root-layout Spectra source repository (`sdd/system/manifest.env` has `repo_mode=canonical`); it is not a consumer `.spectra/` project.

- `sdd/features`, `sdd/governance`, `sdd/memory-bank` are Spectra's own canonical project knowledge. Never reset them from templates.
- `profiles/full/sdd/system` is the authoritative system-file source consumers receive; `packages/core/assets/runtime/scripts` is the authoritative runtime script source. `sdd/system`, `packages/core/assets/runtime/sdd/system` and the root `scripts/` (except `validate-repo.sh`, which may add source-only checks but must keep every line of the packaged validator) are mirrors.
- After changing an authoritative source run `node packages/cli/scripts/sync-assets.mjs --tracked`; `packages/cli/test/source-repo-alignment.test.js` fails when a mirror drifts.
