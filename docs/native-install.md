# Native Install

Use this path when `npm`, `npx`, or Node are unavailable on the target machine.

The npm package remains the primary distribution path. The native installer depends on GitHub Release artifacts being attached for the requested version.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
```

Then use Spectra normally:

```bash
spectra init my-product
cd my-product
spectra validate
```

## Release Artifacts

The installer downloads the matching archive for your platform:

- `spectra-darwin-arm64.tar.gz`
- `spectra-darwin-x64.tar.gz`
- `spectra-linux-arm64.tar.gz`
- `spectra-linux-x64.tar.gz`

Each archive is expected to contain:

- `bin/spectra`
- `assets/runtime/`
- `assets/base/`
- `VERSION`
- `LICENSE`

If a release exists but has no native assets, the installer cannot complete. Use the npm path or rerun the native release workflow for that tag.

## Install Locations

Default locations:

- runtime: `$HOME/.local/share/spectra/<version>/`
- command: `$HOME/.local/bin/spectra`

Override locations:

```bash
SPECTRA_HOME="$HOME/tools/spectra" SPECTRA_BIN="$HOME/bin" sh install.sh
```

Install a specific release from a downloaded installer:

```bash
SPECTRA_VERSION=v2.0.1 sh install.sh
```

Install a specific release through `curl`:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | SPECTRA_VERSION=v2.0.1 sh
```

## Repo-Local Launcher

`spectra init` and `spectra adopt` also create:

```text
.spectra/bin/spectra
```

Use it when global PATH setup is unavailable:

```bash
./.spectra/bin/spectra validate
./.spectra/bin/spectra verify --profile release
```

The launcher tries:

1. recorded native binary path
2. local Node CLI fallback if available
3. `spectra` on PATH

The launcher is intentionally thin. It does not duplicate Spectra logic.

## Requirements

The native installer requires:

- POSIX shell
- `curl`
- `tar`

The first native MVP still expects `bash` for some internal runtime scripts. Node and npm are not required for the native binary path.

## Maintainer Release Notes

Native artifacts are built by `.github/workflows/native-release.yml` on version tags such as `v2.0.1`.

The build uses Node SEA and should run with an official Node.js binary that includes the SEA fuse. If a local Homebrew or distro Node binary fails with a sentinel error, use the GitHub Actions release workflow or install Node from nodejs.org for artifact builds.
