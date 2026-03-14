#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/context-pack.sh --task <pack_id>
USAGE
}

PACK_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      PACK_ID="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "${PACK_ID}" ]]; then
  echo "Error: --task is required." >&2
  usage
  exit 2
fi

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_runtime.sh"

REPO_ROOT="${SPECTRA_REPO_ROOT}"
manifest="${REPO_ROOT}/sdd/system/runtime/context-packs.tsv"

if [[ ! -f "${manifest}" ]]; then
  echo "Error: missing ${manifest}" >&2
  exit 1
fi

awk -F'\t' -v pack="${PACK_ID}" '
  BEGIN { found = 0 }
  /^[[:space:]]*#/ { next }
  NF < 4 { next }
  $1 == pack {
    found = 1
    rows[++n] = $4 "\t" $2
  }
  END {
    if (found == 0) exit 3
    for (i = 1; i <= n; i++) {
      print rows[i]
    }
  }
' "${manifest}" \
  | sort -n \
  | cut -f2-

status=$?
if [[ ${status} -eq 3 ]]; then
  echo "Error: unknown context pack '${PACK_ID}'." >&2
  exit 1
fi
