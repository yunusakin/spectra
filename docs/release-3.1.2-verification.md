# Release 3.1.2 verification

Prepared from main at `9cdb262`. The machine-readable record is
[release-3.1.2-verification.json](release-3.1.2-verification.json).

## Checks completed locally

- Version parity: root, workspace packages, lockfile, CLI constant, runtime and
  template manifests all report 3.1.2. Dependency versions are unchanged.
- Existing test suite: 230 passed, zero failures. Strict validation passed.
- All three workspace tarballs were packed. The public `spectra-pack` package
  passed `npm publish --dry-run`; this does not upload a package.
- macOS arm64 native archive built with bundled Node 24.19.0; its checksum and
  the existing native smoke script passed with Node absent from PATH.
- Package E2E exercised npm installation and the real native installer using a
  local transport for the unpublished archive. A bad checksum was rejected.
- Both distributions passed adoption, launcher, context, index, validation,
  repair, repeat installation and current-version update checks. Updates used
  `SPECTRA_LATEST_VERSION=3.1.2` to avoid a live self-update.
- User memory, plugin documents and the persisted documentation name survived
  repair/re-adoption. Adoption did not execute the application's test command.

The package E2E exposed a local fallback self-deletion bug: a repair invoked
through `.spectra/bin/spectra` deleted the `.spectra/cli/` tree supplying its own
runtime. `materializeLocalNodeCli` now checks real source/target identity before
replacement. The E2E covers normal and symlink project paths, and verifies that
installation into a different project still materializes a usable launcher.

## Repeat

From the repository root:

```sh
node packages/cli/scripts/check-versions.mjs
npm test
npm run check
npm pack --workspace packages/cli --pack-destination /tmp
npm run build:native --workspace packages/cli
mkdir -p .tmp/release-3.1.2/native
tar -xzf packages/cli/dist/native/spectra-darwin-arm64.tar.gz \
  -C .tmp/release-3.1.2/native
node tools/verify-release.mjs 3.1.2 /tmp/spectra-pack-3.1.2.tgz \
  .tmp/release-3.1.2/native/bin/spectra .tmp/release-3.1.2/e2e
```

Use the matching archive filename on another supported platform. Native builds
need an official Node executable with SEA support; Homebrew Node may lack the
required fuse. The E2E creates a fresh run directory each time and retains
command output, expected/actual exit codes, before/after SHA-256 inventories and
preserved-file hashes in `results.json`. Its temporary installer directories
are set with `SPECTRA_HOME` and `SPECTRA_BIN`; it does not change the user's
installed CLI. The local curl transport checks the expected release URLs and
provides the built archive/checksum; it does not test GitHub download availability.

## Remaining publication checks

The release PR runs the existing Node 20/22 validation and four native targets:
darwin-arm64, darwin-x64, linux-arm64 and linux-x64. Their status is visible on
the PR. PR builds do not upload release assets.

After integration, publish `spectra-pack@3.1.2` using an authenticated npm
session and tag the reviewed main commit as `v3.1.2`. The existing tag workflow
builds/uploads native archives and checksums. Use the v3.1.2 section in
[RELEASE_SUMMARY.md](../RELEASE_SUMMARY.md) for the GitHub release body, then
verify the npm dist-tag, all four native archives/checksums and installer URLs.
