# Native Install

Use the native distribution when npm, npx, or Node are unavailable. It provides the same `spectra` CLI as the npm package through a standalone macOS/Linux executable.

## Supported Platforms

- macOS arm64 (Apple Silicon)
- macOS x64 (Intel)
- Linux arm64
- Linux x64

Windows native distribution is not available yet.

## Requirements

The installer requires:

- POSIX shell
- `curl`
- `tar`
- `shasum` or `sha256sum`

Some packaged runtime checks still invoke `bash`. Node and npm are not required.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
```

The installer:

1. detects the operating system and CPU architecture
2. downloads the matching artifact from the latest GitHub Release
3. downloads and verifies the SHA-256 checksum
4. installs the versioned runtime under `$HOME/.local/share/spectra/`
5. links the command at `$HOME/.local/bin/spectra`

Make the command available in the current shell:

```bash
export PATH="$HOME/.local/bin:$PATH"
spectra version
```

For zsh, make the PATH change permanent:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Use with a New Project

```bash
spectra init my-product
cd my-product
spectra status
spectra validate
```

## Use with an Existing Project

Run adoption on a clean branch so the generated operating layer can be reviewed:

```bash
cd existing-project
git switch -c chore/spectra-adoption
spectra adopt .
spectra status
spectra validate
```

Review the generated brownfield outputs under `sdd/adoption/` before advancing approvals.

## Install Locations

Defaults:

- runtime: `$HOME/.local/share/spectra/<version>/`
- command: `$HOME/.local/bin/spectra`

Override them for a local or CI installation:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | \
  SPECTRA_HOME="$HOME/tools/spectra" SPECTRA_BIN="$HOME/bin" sh
```

## Install a Specific Version

```bash
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | \
  SPECTRA_VERSION=v2.0.1 sh
```

Version values use the Git tag form, such as `v2.0.1`.

## Repo-Local Launcher

Both `spectra init` and `spectra adopt` create:

```text
.spectra/bin/spectra
```

Use it when global PATH setup is unavailable or when a repository should invoke its recorded Spectra installation:

```bash
./.spectra/bin/spectra status
./.spectra/bin/spectra validate
./.spectra/bin/spectra verify --profile release
```

The launcher tries the recorded native binary first, then a local Node CLI fallback if present, then `spectra` on PATH. It contains no product logic.

## Release Artifacts

Each release provides an archive and checksum for every supported target:

- `spectra-darwin-arm64.tar.gz`
- `spectra-darwin-x64.tar.gz`
- `spectra-linux-arm64.tar.gz`
- `spectra-linux-x64.tar.gz`
- matching `.tar.gz.sha256` files

Each archive contains:

- `bin/spectra`
- `assets/runtime/`
- `assets/base/`
- `VERSION`
- `LICENSE`

## Troubleshooting

### `spectra: command not found`

Add `$HOME/.local/bin` to PATH, then open a new shell or source the shell profile.

### HTTP 404 while downloading

The requested release does not contain an artifact for the detected platform. Check [GitHub Releases](https://github.com/yunusakin/spectra/releases) or install a known version with `SPECTRA_VERSION`.

### Checksum verification failed

Do not run the downloaded binary. Retry the installation; if it fails again, report the release and platform in a [GitHub issue](https://github.com/yunusakin/spectra/issues).

### Unsupported operating system or architecture

Native installation currently supports only the four targets listed above. Use the npm package on other Node-capable environments.

## Maintainer Notes

Native artifacts are built by `.github/workflows/native-release.yml` on version tags. Builds use Node 22 and Node SEA; release jobs smoke-test `help`, `version`, `init`, and the repo-local launcher before uploading artifacts.
