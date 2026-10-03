#!/usr/bin/env sh
set -eu

REPO="${SPECTRA_REPO:-yunusakin/spectra}"
VERSION="${SPECTRA_VERSION:-latest}"
SPECTRA_HOME="${SPECTRA_HOME:-"$HOME/.local/share/spectra"}"
SPECTRA_BIN="${SPECTRA_BIN:-"$HOME/.local/bin"}"
fail() { echo "spectra install: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"; }
valid_version() { case "$1" in *'
'*|*'
'*) return 1 ;; esac; printf '%s\n' "$1" | LC_ALL=C grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[0-9][0-9]*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?(\+[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$'; }
safe_path() {
  case "$1" in /*) ;; *) fail "installation paths must be absolute: $1" ;; esac
  case "$1" in /|/bin|/usr|/usr/bin|/usr/local|/etc|/var|/private|/private/tmp|/tmp|"$HOME"|*/../*|*/./*|*/..|*/.|*'
'*) fail "unsafe installation path: $1" ;; esac
  cursor="$1"
  while [ "$cursor" != / ]; do
    [ ! -L "$cursor" ] || fail "symlink installation path: $cursor"
    cursor=$(dirname "$cursor")
  done
}
digest() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d ' ' -f 1
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d ' ' -f 1
  else fail "missing checksum command: install shasum or sha256sum"; fi
}
machine_record() { printf 'format=1\nmethod=native\nhome=%s\ncommandPath=%s\ncurrentVersion=%s\n' "$SPECTRA_HOME" "$COMMAND" "$1"; }
version_record() { printf 'format=1\nmethod=%s\nhome=%s\ncommandPath=%s\nversion=%s\nexecutablePath=%s\nsha256=%s\narchiveSha256=%s\ninstallerSha256=%s\n' "${5:-native}" "$SPECTRA_HOME" "$COMMAND" "$1" "$SPECTRA_HOME/$1/bin/spectra" "$2" "$3" "$4"; }
owned_version() {
  candidate="$SPECTRA_HOME/$1"
  [ -d "$candidate" ] && [ ! -L "$candidate" ] && [ -f "$candidate/ownership.env" ] && [ ! -L "$candidate/ownership.env" ] || return 1
  [ -f "$candidate/VERSION" ] && [ ! -L "$candidate/VERSION" ] && [ "$(cat "$candidate/VERSION")" = "$1" ] || return 1
  [ -x "$candidate/bin/spectra" ] && [ ! -L "$candidate/bin" ] && [ ! -L "$candidate/bin/spectra" ] || return 1
  [ -d "$candidate/assets/runtime" ] && [ ! -L "$candidate/assets" ] && [ ! -L "$candidate/assets/runtime" ] || return 1
  archive_digest=$(sed -n 's/^archiveSha256=//p' "$candidate/ownership.env")
  version_method=$(sed -n 's/^method=//p' "$candidate/ownership.env")
  case "$version_method" in
    native) printf '%s\n' "$archive_digest" | grep -Eq '^[a-f0-9]{64}$' || return 1 ;;
    native-legacy) [ "$archive_digest" = unknown ] || return 1 ;;
    *) return 1 ;;
  esac
  [ -f "$candidate/install.sh" ] && [ ! -L "$candidate/install.sh" ] || return 1
  version_record "$1" "$(digest "$candidate/bin/spectra")" "$archive_digest" "$(digest "$candidate/install.sh")" "$version_method" > "$TMP_DIR/expected-version"
  cmp -s "$TMP_DIR/expected-version" "$candidate/ownership.env"
}

need curl; need tar; need grep; need cmp
[ "$VERSION" = latest ] || valid_version "${VERSION#v}" || fail "invalid requested version: $VERSION"
case "$(uname -s)" in Darwin) OS=darwin ;; Linux) OS=linux ;; *) fail "unsupported OS" ;; esac
case "$(uname -m)" in arm64|aarch64) ARCH=arm64 ;; x86_64|amd64) ARCH=x64 ;; *) fail "unsupported architecture" ;; esac
SPECTRA_HOME=${SPECTRA_HOME%/}; SPECTRA_BIN=${SPECTRA_BIN%/}
safe_path "$SPECTRA_HOME"; safe_path "$SPECTRA_BIN"
[ "$SPECTRA_HOME" != "$SPECTRA_BIN" ] || fail "installation home and command directory must differ"
case "$SPECTRA_BIN/" in "$SPECTRA_HOME/"*) fail "command directory must be outside installation home" ;; esac
COMMAND="$SPECTRA_BIN/spectra"
TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t spectra)
STAGE=; COMMAND_TMP=; RECORD_TMP=; BACKUP=; SWITCHED=0; COMMITTED=0
cleanup() {
  if [ "$SWITCHED" = 1 ] && [ "$COMMITTED" = 0 ]; then
    if [ -n "$BACKUP" ] && [ -L "$BACKUP" ]; then mv -f "$BACKUP" "$COMMAND"; else rm -f "$COMMAND"; fi
  fi
  [ -z "$STAGE" ] || rm -rf "$STAGE"
  [ -z "$COMMAND_TMP" ] || rm -f "$COMMAND_TMP"
  [ -z "$RECORD_TMP" ] || rm -f "$RECORD_TMP"
  [ -z "$BACKUP" ] || rm -f "$BACKUP"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
trap 'exit 1' INT TERM
OLD_VERSION=
if [ -e "$SPECTRA_HOME/installation.env" ] || [ -L "$SPECTRA_HOME/installation.env" ]; then
  [ -f "$SPECTRA_HOME/installation.env" ] && [ ! -L "$SPECTRA_HOME/installation.env" ] || fail "unsafe machine ownership record"
  OLD_VERSION=$(sed -n 's/^currentVersion=//p' "$SPECTRA_HOME/installation.env")
  valid_version "$OLD_VERSION" || fail "invalid machine ownership record"
  machine_record "$OLD_VERSION" > "$TMP_DIR/expected-machine"
  cmp -s "$TMP_DIR/expected-machine" "$SPECTRA_HOME/installation.env" || fail "machine ownership record does not match these paths"
  owned_version "$OLD_VERSION" || fail "active version ownership is not verified"
  [ -L "$COMMAND" ] && [ "$(readlink "$COMMAND")" = "$SPECTRA_HOME/$OLD_VERSION/bin/spectra" ] || fail "command activation does not match ownership record"
elif [ -e "$COMMAND" ] || [ -L "$COMMAND" ]; then
  echo 'For an unverified old installation, preserve it and use a fresh managed location:' >&2
  echo '  spectra_root="$(mktemp -d "$HOME/spectra-XXXXXX")"' >&2
  echo '  curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | SPECTRA_HOME="$spectra_root/runtime" SPECTRA_BIN="$spectra_root/bin" sh' >&2
  echo '  export PATH="$spectra_root/bin:$PATH"' >&2
  fail "refusing to replace foreign command without executing-native ownership proof: $COMMAND"
fi

ASSET="spectra-${OS}-${ARCH}.tar.gz"
if [ "$VERSION" = latest ]; then URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
else URL="https://github.com/${REPO}/releases/download/v${VERSION#v}/${ASSET}"; fi
echo "Downloading ${ASSET} from ${REPO}..."
curl -fsSL "$URL" -o "$TMP_DIR/$ASSET"
curl -fsSL "$URL.sha256" -o "$TMP_DIR/$ASSET.sha256"
ARCHIVE_DIGEST=$(digest "$TMP_DIR/$ASSET")
printf '%s  %s\n' "$ARCHIVE_DIGEST" "$ASSET" > "$TMP_DIR/expected-checksum"
cmp -s "$TMP_DIR/expected-checksum" "$TMP_DIR/$ASSET.sha256" || fail "archive checksum mismatch"
tar -tzf "$TMP_DIR/$ASSET" > "$TMP_DIR/entries"
while IFS= read -r entry; do
  case "$entry" in /*|..|../*|*/../*|*/..|*'
'*) fail "unsafe archive path: $entry" ;; esac
done < "$TMP_DIR/entries"
tar -tvzf "$TMP_DIR/$ASSET" > "$TMP_DIR/types"
grep -Eq '^[^d-]' "$TMP_DIR/types" && fail "archive contains links or special files"
mkdir "$TMP_DIR/extract"
tar -xzf "$TMP_DIR/$ASSET" -C "$TMP_DIR/extract"
[ -f "$TMP_DIR/extract/VERSION" ] || fail "archive VERSION is missing"
INSTALLED_VERSION=$(cat "$TMP_DIR/extract/VERSION")
valid_version "$INSTALLED_VERSION" || fail "invalid archive VERSION: $INSTALLED_VERSION"
[ "$VERSION" = latest ] || [ "$INSTALLED_VERSION" = "${VERSION#v}" ] || fail "archive version does not match requested version"
RUNTIME="$TMP_DIR/extract"
[ -f "$RUNTIME/install.sh" ] && [ -x "$RUNTIME/bin/spectra" ] && [ -f "$RUNTIME/LICENSE" ] && [ -f "$RUNTIME/assets/profiles/full/profile.yaml" ] && [ -f "$RUNTIME/assets/runtime/sdd/system/manifest.env" ] || fail "archive runtime is incomplete"
[ "$("$RUNTIME/bin/spectra" version)" = "spectra $INSTALLED_VERSION" ] || fail "executable version mismatch: expected $INSTALLED_VERSION"
"$RUNTIME/bin/spectra" help >/dev/null || fail "executable smoke check failed"
INSTALL_DIR="$SPECTRA_HOME/$INSTALLED_VERSION"
if [ -e "$INSTALL_DIR" ] || [ -L "$INSTALL_DIR" ]; then
  owned_version "$INSTALLED_VERSION" || fail "refusing to replace foreign version: $INSTALL_DIR"
  [ "$archive_digest" = "$ARCHIVE_DIGEST" ] || fail "same-version archive differs; use a distinct application version"
else
  mkdir -p "$SPECTRA_HOME"
  STAGE=$(mktemp -d "$SPECTRA_HOME/.stage-XXXXXX")
  cp -R "$RUNTIME/." "$STAGE/"
  version_record "$INSTALLED_VERSION" "$(digest "$STAGE/bin/spectra")" "$ARCHIVE_DIGEST" "$(digest "$STAGE/install.sh")" > "$STAGE/ownership.env"
  [ "$("$STAGE/bin/spectra" version)" = "spectra $INSTALLED_VERSION" ] || fail "staged executable version mismatch"
  "$STAGE/bin/spectra" help >/dev/null || fail "staged runtime smoke check failed"
  safe_path "$SPECTRA_HOME"
  [ ! -e "$INSTALL_DIR" ] && [ ! -L "$INSTALL_DIR" ] || fail "version destination changed during installation"
  mv "$STAGE" "$INSTALL_DIR"; STAGE=
fi
mkdir -p "$SPECTRA_BIN"
safe_path "$SPECTRA_HOME"; safe_path "$SPECTRA_BIN"
if [ -n "$OLD_VERSION" ]; then
  owned_version "$OLD_VERSION" && [ -L "$COMMAND" ] && [ "$(readlink "$COMMAND")" = "$SPECTRA_HOME/$OLD_VERSION/bin/spectra" ] || fail "activation changed during installation"
else [ ! -e "$COMMAND" ] && [ ! -L "$COMMAND" ] || fail "command destination changed during installation"; fi
COMMAND_TMP=$(mktemp "$SPECTRA_BIN/.spectra-link-XXXXXX"); rm -f "$COMMAND_TMP"
ln -s "$INSTALL_DIR/bin/spectra" "$COMMAND_TMP" || fail "could not create command symlink; no copied executable fallback is supported"
RECORD_TMP=$(mktemp "$SPECTRA_HOME/.installation-XXXXXX")
machine_record "$INSTALLED_VERSION" > "$RECORD_TMP"
if [ -L "$COMMAND" ]; then BACKUP=$(mktemp "$SPECTRA_BIN/.spectra-backup-XXXXXX"); rm -f "$BACKUP"; cp -P "$COMMAND" "$BACKUP"; fi
mv -f "$COMMAND_TMP" "$COMMAND"; COMMAND_TMP=; SWITCHED=1
[ "$("$COMMAND" version)" = "spectra $INSTALLED_VERSION" ] || fail "activated executable version mismatch"
"$COMMAND" help >/dev/null || fail "activated runtime smoke check failed"
mv -f "$RECORD_TMP" "$SPECTRA_HOME/installation.env"; RECORD_TMP=; COMMITTED=1
echo "Installed spectra $INSTALLED_VERSION to $INSTALL_DIR"
echo "Linked command: $COMMAND"
case ":$PATH:" in *":$SPECTRA_BIN:"*) ;; *) printf '\nAdd this to your shell profile if spectra is not found:\n  export PATH="%s:$PATH"\n' "$SPECTRA_BIN" ;; esac
"$COMMAND" version
