#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/spec-diff.sh --init [options]
  bash scripts/spec-diff.sh --update [options]

Options:
  --report <path>     Markdown report path (default: sdd/memory-bank/core/spec-diff.md)
  --scope <path>      Diff scope root (default: sdd/memory-bank)
  --base <git-ref>    Base ref (default: last recorded "Head ref:" in the report)
  --no-worktree       Compare commits only (base..HEAD), ignore uncommitted changes
  --patch             Include per-file patches
  --stdout            Print the generated entry to stdout (do not write the report)

Examples:
  bash scripts/spec-diff.sh --init
  bash scripts/spec-diff.sh --update
  bash scripts/spec-diff.sh --update --base origin/main --no-worktree
EOF
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE=""
REPORT="sdd/memory-bank/core/spec-diff.md"
SCOPE="sdd/memory-bank"
BASE_REF=""
NO_WORKTREE=0
INCLUDE_PATCH=0
STDOUT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --init) MODE="init"; shift ;;
    --update) MODE="update"; shift ;;
    --report) REPORT="$2"; shift 2 ;;
    --scope) SCOPE="$2"; shift 2 ;;
    --base) BASE_REF="$2"; shift 2 ;;
    --no-worktree) NO_WORKTREE=1; shift ;;
    --patch) INCLUDE_PATCH=1; shift ;;
    --stdout) STDOUT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "${MODE}" ]]; then
  echo "Error: choose one of --init or --update" >&2
  usage
  exit 2
fi

if [[ ! -d ".git" ]]; then
  echo "Error: this does not look like a git repository (missing .git)." >&2
  exit 2
fi

timestamp_utc() { date -u +"%Y-%m-%d %H:%M:%SZ"; }
head_ref() { git rev-parse HEAD; }

ensure_report_exists() {
  local report_path="$1"
  mkdir -p "$(dirname "${report_path}")"
  if [[ ! -f "${report_path}" ]]; then
    cat > "${report_path}" <<'EOF'
# Spec Diff Report

> This file is updated by `bash scripts/spec-diff.sh`.

EOF
  fi
}

parse_last_head_ref() {
  local report_path="$1"
  if [[ ! -f "${report_path}" ]]; then
    return 0
  fi
  grep '^Head ref:' "${report_path}" | tail -n 1 | sed 's/^Head ref:[[:space:]]*//'
}

is_excluded() {
  local p="$1"
  case "$p" in
    sdd/memory-bank/core/intake-state.md) return 0 ;;
    sdd/memory-bank/core/progress.md) return 0 ;;
    sdd/memory-bank/core/progress-archive.md) return 0 ;;
    sdd/memory-bank/core/sprint-current.md) return 0 ;;
    sdd/memory-bank/core/sprint-plan.md) return 0 ;;
    sdd/memory-bank/core/backlog.md) return 0 ;;
    sdd/memory-bank/core/spec-diff.md) return 0 ;;
  esac
  return 1
}

diff_name_status() {
  local base="$1"
  local scope="$2"
  if [[ "${NO_WORKTREE}" -eq 1 ]]; then
    git diff --name-status "${base}..HEAD" -- "${scope}" || true
  else
    git diff --name-status "${base}" -- "${scope}" || true
  fi
}

diff_patch_for_file() {
  local base="$1"
  local file="$2"
  if [[ "${NO_WORKTREE}" -eq 1 ]]; then
    git diff "${base}..HEAD" -- "${file}" || true
  else
    git diff "${base}" -- "${file}" || true
  fi
}

head="$(head_ref)"
report_path="${REPORT}"

ensure_report_exists "${report_path}"

if [[ "${MODE}" == "init" ]]; then
  entry="$(
    cat <<EOF
## $(timestamp_utc)

Base ref: ${head}
Head ref: ${head}
Scope: ${SCOPE}
Includes worktree: no

### Summary
- Baseline initialized (no diff).
EOF
  )"
  if [[ "${STDOUT}" -eq 1 ]]; then
    printf '%s\n' "${entry}"
    exit 0
  fi
  printf '\n\n%s\n' "${entry}" >> "${report_path}"
  exit 0
fi

# --update
base="${BASE_REF:-}"
if [[ -z "${base}" ]]; then
  base="$(parse_last_head_ref "${report_path}" || true)"
fi

if [[ -z "${base}" ]]; then
  echo "Error: no base ref found. Run once with --init, or pass --base <git-ref>." >&2
  exit 2
fi

out="$(diff_name_status "${base}" "${SCOPE}")"

added=()
modified=()
deleted=()
renamed=()

while IFS=$'\t' read -r status p1 p2; do
  [[ -n "${status}" ]] || continue

  if [[ "${status}" == R* ]]; then
    old="${p1}"
    new="${p2}"
    if is_excluded "${old}" || is_excluded "${new}"; then
      continue
    fi
    renamed+=("${old} -> ${new}")
    continue
  fi

  p="${p1}"
  if is_excluded "${p}"; then
    continue
  fi

  case "${status}" in
    A) added+=("${p}") ;;
    D) deleted+=("${p}") ;;
    *) modified+=("${p}") ;;
  esac
done <<< "${out}"

count_added="${#added[@]}"
count_modified="${#modified[@]}"
count_deleted="${#deleted[@]}"
count_renamed="${#renamed[@]}"

entry_lines=()
entry_lines+=("## $(timestamp_utc)")
entry_lines+=("")
entry_lines+=("Base ref: ${base}")
entry_lines+=("Head ref: ${head}")
entry_lines+=("Scope: ${SCOPE}")
entry_lines+=("Includes worktree: $([[ "${NO_WORKTREE}" -eq 1 ]] && echo no || echo yes)")
entry_lines+=("Excludes:")
entry_lines+=("- \`sdd/memory-bank/core/intake-state.md\`")
entry_lines+=("- \`sdd/memory-bank/core/progress.md\`")
entry_lines+=("- \`sdd/memory-bank/core/progress-archive.md\`")
entry_lines+=("- \`sdd/memory-bank/core/sprint-current.md\`")
entry_lines+=("- \`sdd/memory-bank/core/sprint-plan.md\`")
entry_lines+=("- \`sdd/memory-bank/core/backlog.md\`")
entry_lines+=("- \`sdd/memory-bank/core/spec-diff.md\`")
entry_lines+=("")
entry_lines+=("### Summary")
entry_lines+=("- Added: ${count_added}")
entry_lines+=("- Modified: ${count_modified}")
entry_lines+=("- Deleted: ${count_deleted}")
entry_lines+=("- Renamed: ${count_renamed}")
entry_lines+=("")

if [[ "${count_added}" -gt 0 ]]; then
  entry_lines+=("### Added")
  for p in "${added[@]}"; do entry_lines+=("- \`${p}\`"); done
  entry_lines+=("")
fi
if [[ "${count_modified}" -gt 0 ]]; then
  entry_lines+=("### Modified")
  for p in "${modified[@]}"; do entry_lines+=("- \`${p}\`"); done
  entry_lines+=("")
fi
if [[ "${count_deleted}" -gt 0 ]]; then
  entry_lines+=("### Deleted")
  for p in "${deleted[@]}"; do entry_lines+=("- \`${p}\`"); done
  entry_lines+=("")
fi
if [[ "${count_renamed}" -gt 0 ]]; then
  entry_lines+=("### Renamed")
  for r in "${renamed[@]}"; do entry_lines+=("- \`${r}\`"); done
  entry_lines+=("")
fi

if [[ "${INCLUDE_PATCH}" -eq 1 ]]; then
  entry_lines+=("### Patch")
  entry_lines+=("")
  for p in "${added[@]}" "${modified[@]}" "${deleted[@]}"; do
    [[ -n "${p}" ]] || continue
    patch="$(diff_patch_for_file "${base}" "${p}")"
    entry_lines+=("#### \`${p}\`")
    entry_lines+=("")
    entry_lines+=("```diff")
    if [[ -n "${patch}" ]]; then
      entry_lines+=("${patch}")
    else
      entry_lines+=("(no changes)")
    fi
    entry_lines+=("```")
    entry_lines+=("")
  done
fi

entry="$(printf '%s\n' "${entry_lines[@]}")"

if [[ "${STDOUT}" -eq 1 ]]; then
  printf '%s\n' "${entry}"
  exit 0
fi

printf '\n\n%s\n' "${entry}" >> "${report_path}"
exit 0

