# Native Install

Use this path when `npm`, `npx`, or Node are not available on the target machine.

This installer requires a published GitHub Release with native artifacts. Before the first native release is cut,
the install command will fail because there is no archive to download yet.

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

## What It Installs

The installer downloads the matching GitHub Release archive for your platform:

- `spectra-darwin-arm64.tar.gz`
- `spectra-darwin-x64.tar.gz`
- `spectra-linux-arm64.tar.gz`
- `spectra-linux-x64.tar.gz`

Default install locations:

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

The launcher tries the recorded native binary first, then a local Node CLI if available, then `spectra` on PATH.

## Requirements

The native installer requires:

- POSIX shell
- `curl`
- `tar`

The first native MVP still expects `bash` for some internal runtime scripts. Node and npm are not required for the native binary path.

## Maintainer Release Notes

Native artifacts are built by `.github/workflows/native-release.yml` on version tags such as `v2.0.1`.
The build uses Node SEA and must run with an official Node.js binary that includes the SEA fuse.
If a local Homebrew or distro Node binary fails with a sentinel error, use the GitHub Actions release workflow
or install Node from nodejs.org for artifact builds.
