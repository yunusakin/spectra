#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/quick.sh --type docs|rules|spec|ops --task "<description>"
USAGE
}

TYPE=""
TASK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      TYPE="${2:-}"
      shift 2
      ;;
    --task)
      TASK="${2:-}"
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

case "${TYPE}" in
  docs|rules|spec|ops) ;;
  *)
    echo "Error: --type must be one of docs|rules|spec|ops." >&2
    exit 2
    ;;
esac

if [[ -z "${TASK}" ]]; then
  echo "Error: --task is required." >&2
  exit 2
fi

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_runtime.sh"

REPO_ROOT="${SPECTRA_REPO_ROOT}"
cd "${REPO_ROOT}"

changed_files="$(
  {
    git diff --name-only HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sed '/^$/d' | sort -u
)"

if echo "${changed_files}" | grep -Eq '^app/.*'; then
  echo "Quick lane blocked: app/* changes detected." >&2
  echo "Use the full Spectra workflow instead." >&2
  exit 1
fi

echo "Quick lane"
echo "=========="
echo "Type: ${TYPE}"
echo "Task: ${TASK}"
echo ""

run_runtime_script validate-repo.sh --strict
run_runtime_script check-policy.sh

echo "Quick lane: OK"
