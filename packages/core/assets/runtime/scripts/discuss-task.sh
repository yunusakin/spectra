#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/discuss-task.sh --item <id> --task-type <type> --goal "<text>"
USAGE
}

ITEM_ID=""
TASK_TYPE=""
GOAL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --item)
      ITEM_ID="${2:-}"
      shift 2
      ;;
    --task-type)
      TASK_TYPE="${2:-}"
      shift 2
      ;;
    --goal)
      GOAL="${2:-}"
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

if [[ -z "${ITEM_ID}" || -z "${TASK_TYPE}" || -z "${GOAL}" ]]; then
  echo "Error: --item, --task-type, and --goal are required." >&2
  usage
  exit 2
fi

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_runtime.sh"

REPO_ROOT="${SPECTRA_REPO_ROOT}"
brief="${REPO_ROOT}/sdd/memory-bank/core/implementation-brief.md"

cat > "${brief}" <<EOF
# Implementation Brief

> Capture implementation intent before coding starts.

## Item ID
${ITEM_ID}

## Task Type
${TASK_TYPE}

## Goal
${GOAL}

## Scope Notes
- Define precise touched areas before coding.

## Interface Impact
- List any user-facing or integration-facing changes here.

## Risks
- Record known risks before coding.

## Test Intent
- Define how this item will be verified.

## Open Implementation Questions
- (none)
EOF

echo "Implementation brief: OK"
