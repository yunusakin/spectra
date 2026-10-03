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

Install the native application once. The installer:

1. detects the operating system and CPU architecture
2. downloads the matching artifact from the latest GitHub Release
3. downloads and verifies the SHA-256 checksum
4. installs the versioned runtime under `$HOME/.local/share/spectra/<version>/`
5. links the command at `$HOME/.local/bin/spectra`

Initialize or adopt each repository separately with `spectra init` or `spectra adopt`. Installing the application does not create or migrate project state.

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
spectra check
```

## Use with an Existing Project

Run adoption on a clean branch so the generated operating layer can be reviewed:

```bash
cd existing-project
git switch -c chore/spectra-adoption
spectra adopt .
spectra status
spectra check
```

Review generated brownfield outputs under `.spectra/sdd/adoption/` before advancing approvals.

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
  SPECTRA_VERSION=v3.1.2 sh
```

Version values use the Git tag form, such as `v3.0.9`.

## Update the Application

For a managed native install, update the machine application independently of project migration:

```bash
spectra update --yes
```

This updates the installed native CLI/runtime and active command. It does not search for projects or change their files. The updater retains verified version directories; older recorded launch paths forward to the active command, with the previous executable bytes kept as `.rollback` for update recovery. There is no public command to switch back to an older version.

For a global npm install, update the package with `npm install -g spectra-pack@latest`. npx has no global package to update; request a version on the next invocation with `npx spectra-pack@latest`.

Project migrations are separate and explicit. Run the check and migration from the project directory:

```bash
spectra migrate --check
spectra migrate --yes
```

`--check` never writes and exits nonzero when a migration is required. `--yes` applies the reported layout/schema steps and validates the project. Use `--json` for machine-readable results. A current-schema project can refresh generated assets with `spectra doctor --fix`; that command does not migrate an older schema.

## Versions and Distribution Source

The public application release version (for example, `3.1.2`) identifies the npm package, CLI, native binary and packaged runtime. `install.json` separately records `cliVersion`, `runtimeVersion` and the numeric project `schemaVersion` (currently `3`). Feature, evaluation and governance contracts use `apiVersion: spectra/v2`; that contract format is separate from both the application release and the installation schema. Installer pins use the Git tag spelling, such as `SPECTRA_VERSION=v3.1.2`.

Native update discovery checks the configured npm registry, then the GitHub Releases API. The installer downloads its script from GitHub and the archive/checksum from GitHub Releases. `SPECTRA_REPO=owner/repository` selects the release repository for archive downloads; it is not a generic mirror or offline-install switch. If company network policy blocks those endpoints, use an approved package distribution path or ask the administrator for an accessible release source.

## Repo-Local Launcher

Both `spectra init` and `spectra adopt` create:

```text
.spectra/bin/spectra
```

Use it when global PATH setup is unavailable or when a repository should invoke its recorded Spectra installation:

```bash
./.spectra/bin/spectra status
./.spectra/bin/spectra check
```

The launcher tries its recorded stable machine command, recorded native executable, project-local Node CLI when present, then `spectra` on PATH. A Node/npm project usually includes that local fallback; a native-only project may rely on its recorded native path or another `spectra` on PATH. If every fallback is removed, the launcher exits with an error until you reinstall or provide another command.

For older standalone native binaries without a machine ownership record, `spectra uninstall` refuses and leaves the installation untouched. Update it to a newer managed version, then retry removal:

```bash
spectra update --yes
spectra uninstall --yes
```

If update cannot manage that installation, install a managed native version in a separate home/bin location, then use its command. Project-local launchers pinned to the older standalone binary remain pinned until that project is bootstrapped again.

## Uninstall

For a verified managed native installation:

```bash
spectra uninstall
```

The command asks before removing the stable command and every verified managed native version; non-interactive use requires `spectra uninstall --yes`. It never changes `.spectra/`, project code, adapters or Git exclusions. A project-local Node CLI can continue to work when Node is available; a native-only project needs another native/PATH command or a reinstall after removal.

Other distributions use their own lifecycle:

| Installation | Update or remove |
| --- | --- |
| Managed native | `spectra update`; `spectra uninstall [--yes]` |
| Legacy native without ownership record | `spectra update --yes`, then `spectra uninstall --yes` |
| Global npm | `npm install -g spectra-pack@latest`; `npm uninstall -g spectra-pack` |
| npx | Choose `npx spectra-pack@latest` per invocation; no machine package to uninstall |
| Project-local fallback or development checkout | No managed machine installation; the project files remain in that checkout |

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
- `assets/profiles/`
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

Native artifacts are built by `.github/workflows/native-release.yml` on version tags. Builds use Node 22 and Node SEA; release jobs smoke-test the default setup, `help`, `version`, `status`, `check`, update detection, and the repo-local launcher before uploading artifacts.
