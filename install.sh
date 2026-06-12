#!/usr/bin/env sh
set -eu

REPO="${SPECTRA_REPO:-yunusakin/spectra}"
VERSION="${SPECTRA_VERSION:-latest}"
SPECTRA_HOME="${SPECTRA_HOME:-"$HOME/.local/share/spectra"}"
SPECTRA_BIN="${SPECTRA_BIN:-"$HOME/.local/bin"}"

fail() {
  echo "spectra install: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *) fail "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    arm64|aarch64) echo "arm64" ;;
    x86_64|amd64) echo "x64" ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
}

need curl
need tar

OS="$(detect_os)"
ARCH="$(detect_arch)"
ASSET="spectra-${OS}-${ARCH}.tar.gz"

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t spectra)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
else
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
fi

echo "Downloading ${ASSET} from ${REPO}..."
curl -fsSL "$URL" -o "$TMP_DIR/$ASSET"

mkdir -p "$TMP_DIR/extract"
tar -xzf "$TMP_DIR/$ASSET" -C "$TMP_DIR/extract"

if [ ! -x "$TMP_DIR/extract/bin/spectra" ]; then
  fail "downloaded archive does not contain bin/spectra"
fi

INSTALLED_VERSION="$(cat "$TMP_DIR/extract/VERSION" 2>/dev/null || printf '%s' "$VERSION")"
INSTALL_DIR="${SPECTRA_HOME}/${INSTALLED_VERSION}"

mkdir -p "$SPECTRA_HOME"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -R "$TMP_DIR/extract/." "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/bin/spectra"

mkdir -p "$SPECTRA_BIN"
if ln -sfn "$INSTALL_DIR/bin/spectra" "$SPECTRA_BIN/spectra" 2>/dev/null; then
  :
else
  cp "$INSTALL_DIR/bin/spectra" "$SPECTRA_BIN/spectra"
  chmod +x "$SPECTRA_BIN/spectra"
fi

echo "Installed Spectra ${INSTALLED_VERSION} to ${INSTALL_DIR}"
echo "Linked command: ${SPECTRA_BIN}/spectra"

case ":$PATH:" in
  *":$SPECTRA_BIN:"*) ;;
  *)
    echo ""
    echo "Add this to your shell profile if spectra is not found:"
    echo "  export PATH=\"$SPECTRA_BIN:\$PATH\""
    ;;
esac

"$SPECTRA_BIN/spectra" version
