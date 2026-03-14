#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/verify-work.sh [--item <id>] [--scope all|spec|app]
USAGE
}

ITEM_ID=""
SCOPE="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --item)
      ITEM_ID="${2:-}"
      shift 2
      ;;
    --scope)
      SCOPE="${2:-}"
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

case "${SCOPE}" in
  all|spec|app) ;;
  *)
    echo "Error: --scope must be one of all|spec|app." >&2
    exit 2
    ;;
esac

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_runtime.sh"

REPO_ROOT="${SPECTRA_REPO_ROOT}"
cd "${REPO_ROOT}"

blocked=0

has_real_content() {
  local file="$1"
  [[ -f "${file}" ]] || return 1
  grep -v '^#\|^>\|^$\|^<!--\|^-->' "${file}" 2>/dev/null | grep -v '^[[:space:]]*$' | head -1 | grep -q .
}

echo "Spectra Verify Work"
echo "==================="
echo "Item: ${ITEM_ID:-n/a}"
echo "Scope: ${SCOPE}"
echo ""

if run_runtime_script validate-repo.sh --strict >/dev/null 2>&1; then
  echo "OK   validate-repo.sh --strict"
else
  echo "FAIL validate-repo.sh --strict"
  blocked=1
fi

if run_runtime_script check-policy.sh >/dev/null 2>&1; then
  echo "OK   check-policy.sh"
else
  echo "FAIL check-policy.sh"
  blocked=1
fi

if awk '
  BEGIN { in_section = 0; in_comment = 0 }
  {
    if ($0 ~ /<!--/) in_comment = 1
    if (in_comment == 1) {
      if ($0 ~ /-->/) in_comment = 0
      next
    }
    if ($0 ~ /^##[[:space:]]+Findings/) {
      in_section = 1
      next
    }
    if (in_section == 1 && $0 ~ /^##[[:space:]]+/) exit
    if (in_section == 1 && $0 ~ /^[[:space:]]*\|/) {
      if ($0 ~ /^[[:space:]]*\|[[:space:]-]+\|/) next
      line = tolower($0)
      if ((line ~ /critical/ || line ~ /warning/) && line !~ /resolved/) {
        found = 1
      }
    }
  }
  END { exit(found ? 0 : 1) }
' sdd/memory-bank/core/review-gate.md 2>/dev/null; then
  echo "FAIL review-gate has unresolved critical/warning findings"
  blocked=1
else
  echo "OK   review-gate"
fi

if has_real_content "sdd/memory-bank/core/traceability.md"; then
  echo "OK   traceability has content"
else
  if [[ "${SCOPE}" == "app" ]]; then
    echo "FAIL traceability is empty for app verification"
    blocked=1
  else
    echo "WARN traceability is empty"
  fi
fi

if has_real_content "sdd/memory-bank/core/activeContext.md"; then
  echo "OK   activeContext populated"
else
  echo "FAIL activeContext empty"
  blocked=1
fi

if has_real_content "sdd/memory-bank/core/progress.md"; then
  echo "OK   progress populated"
else
  echo "FAIL progress empty"
  blocked=1
fi

if [[ "${SCOPE}" == "app" || -n "${ITEM_ID}" ]]; then
  if has_real_content "sdd/memory-bank/core/implementation-brief.md"; then
    echo "OK   implementation brief populated"
  else
    echo "FAIL implementation brief missing or template-only"
    blocked=1
  fi
fi

if [[ ${blocked} -eq 0 ]]; then
  echo ""
  echo "Verify work: READY"
  exit 0
fi

echo ""
echo "Verify work: BLOCKED"
exit 1
