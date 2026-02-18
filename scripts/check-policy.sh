#!/usr/bin/env bash
set -euo pipefail

# check-policy.sh — Approval-gate and quality policy checks.
# Supports local checks and explicit commit range checks for CI.

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/check-policy.sh [--base <git-ref-or-sha>] [--head <git-ref-or-sha>]

Checks:
- Approval gate: no non-README app code unless intake-state Approval Status is `approved`
- Open technical questions block approval and app code changes
- Open technical questions require an issue reference
- Review gate: unresolved critical/warning findings are blocking
- Invariant change trail: invariants.md changes require spec-history.md or arch/decisions.md updates
- Required specs do not contain unresolved placeholders (TBD/TODO/<...>)
- Progress tracking: if sdd/* or app/* changed in checked range, progress.md must be touched

Examples:
  bash scripts/check-policy.sh
  bash scripts/check-policy.sh --base origin/main --head HEAD
USAGE
}

BASE_REF=""
HEAD_REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_REF="${2:-}"
      shift 2
      ;;
    --head)
      HEAD_REF="${2:-}"
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

if [[ -n "${BASE_REF}" && -z "${HEAD_REF}" ]] || [[ -z "${BASE_REF}" && -n "${HEAD_REF}" ]]; then
  echo "Error: --base and --head must be provided together." >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

errors=()
add_error() { errors+=("$1"); }

parse_approval_status() {
  local state_file="$1"
  if [[ ! -f "${state_file}" ]]; then
    return 0
  fi

  awk '
    BEGIN { in_section = 0; in_comment = 0 }
    {
      if ($0 ~ /<!--/) in_comment = 1
      if (in_comment == 1) {
        if ($0 ~ /-->/) in_comment = 0
        next
      }

      if ($0 ~ /^##[[:space:]]+Approval Status[[:space:]]*$/) {
        in_section = 1
        next
      }

      if (in_section == 1 && $0 ~ /^##[[:space:]]+/) {
        exit
      }

      if (in_section == 1) {
        line = $0
        gsub(/^[[:space:]-]+/, "", line)
        gsub(/[[:space:]]+$/, "", line)
        if (line != "") {
          print tolower(line)
          exit
        }
      }
    }
  ' "${state_file}" 2>/dev/null || true
}

parse_open_technical_questions() {
  local state_file="$1"
  if [[ ! -f "${state_file}" ]]; then
    return 0
  fi

  awk '
    function trim(s) {
      gsub(/^[[:space:]]+/, "", s)
      gsub(/[[:space:]]+$/, "", s)
      return s
    }

    BEGIN { in_section = 0; in_comment = 0 }
    {
      if ($0 ~ /<!--/) in_comment = 1
      if (in_comment == 1) {
        if ($0 ~ /-->/) in_comment = 0
        next
      }

      if ($0 ~ /^##[[:space:]]+Open Technical Questions[[:space:]]*$/) {
        in_section = 1
        next
      }

      if (in_section == 1 && $0 ~ /^##[[:space:]]+/) {
        exit
      }

      if (in_section == 1 && $0 ~ /^[[:space:]]*\|/) {
        line = $0
        if (line ~ /^[[:space:]]*\|[[:space:]-]+\|/) next

        gsub(/^[[:space:]]*\|/, "", line)
        gsub(/\|[[:space:]]*$/, "", line)
        n = split(line, cols, "|")
        if (n < 4) next

        qid = trim(cols[1])
        status = tolower(trim(cols[3]))
        issue = trim(cols[4])

        if (qid == "" || qid == "Question ID") next
        print qid "\t" status "\t" issue
      }
    }
  ' "${state_file}" 2>/dev/null || true
}

parse_blocking_review_findings() {
  local review_file="$1"
  if [[ ! -f "${review_file}" ]]; then
    return 0
  fi

  awk '
    function trim(s) {
      gsub(/^[[:space:]]+/, "", s)
      gsub(/[[:space:]]+$/, "", s)
      return s
    }

    BEGIN { in_section = 0; in_comment = 0 }
    {
      if ($0 ~ /<!--/) in_comment = 1
      if (in_comment == 1) {
        if ($0 ~ /-->/) in_comment = 0
        next
      }

      if ($0 ~ /^##[[:space:]]+Findings[[:space:]]*$/) {
        in_section = 1
        next
      }

      if (in_section == 1 && $0 ~ /^##[[:space:]]+/) {
        exit
      }

      if (in_section == 1 && $0 ~ /^[[:space:]]*\|/) {
        line = $0
        if (line ~ /^[[:space:]]*\|[[:space:]-]+\|/) next

        gsub(/^[[:space:]]*\|/, "", line)
        gsub(/\|[[:space:]]*$/, "", line)
        n = split(line, cols, "|")
        if (n < 5) next

        scope = trim(cols[2])
        severity = tolower(trim(cols[4]))
        status = tolower(trim(cols[5]))

        if (severity == "severity") next
        if ((severity == "critical" || severity == "warning") && status != "resolved") {
          print severity "\t" scope "\t" status
        }
      }
    }
  ' "${review_file}" 2>/dev/null || true
}

collect_changed_files() {
  if [[ -n "${BASE_REF}" ]]; then
    if ! git rev-parse --verify "${BASE_REF}^{commit}" >/dev/null 2>&1; then
      add_error "Base ref not found or not a commit: ${BASE_REF}"
      return 0
    fi
    if ! git rev-parse --verify "${HEAD_REF}^{commit}" >/dev/null 2>&1; then
      add_error "Head ref not found or not a commit: ${HEAD_REF}"
      return 0
    fi
    git diff --name-only "${BASE_REF}...${HEAD_REF}" 2>/dev/null || true
    return 0
  fi

  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    git diff --name-only HEAD~1..HEAD 2>/dev/null || true
    return 0
  fi

  return 0
}

state_file="sdd/memory-bank/core/intake-state.md"
review_gate_file="sdd/memory-bank/core/review-gate.md"
invariants_file="sdd/memory-bank/core/invariants.md"
spec_history_file="sdd/memory-bank/core/spec-history.md"
arch_decisions_file="sdd/memory-bank/arch/decisions.md"

approval_status="$(parse_approval_status "${state_file}")"
open_questions="$(parse_open_technical_questions "${state_file}")"
blocking_findings="$(parse_blocking_review_findings "${review_gate_file}")"
changed_files="$(collect_changed_files)"

app_has_code=false
if [[ -d "app" ]]; then
  app_files="$(find app -type f ! -name 'README.md' | head -1)"
  if [[ -n "${app_files}" ]]; then
    app_has_code=true
  fi
fi

###################################
# 1. Approval gate: no app/ code without approval evidence
###################################
if "${app_has_code}"; then
  if [[ ! -f "${state_file}" ]]; then
    add_error "app/ contains code but ${state_file} does not exist."
  elif [[ "${approval_status}" != "approved" ]]; then
    add_error "app/ contains code but Approval Status is not 'approved' in ${state_file}."
  fi
fi

###################################
# 2. Open technical questions policy
###################################
open_count=0
if [[ -n "${open_questions}" ]]; then
  while IFS=$'\t' read -r qid status issue; do
    [[ -n "${qid}" ]] || continue

    if [[ "${status}" == "open" ]]; then
      open_count=$((open_count + 1))

      if [[ -z "${issue}" || "${issue}" == "-" || "${issue}" == "(none)" ]]; then
        add_error "Open technical question ${qid} is missing issue reference in ${state_file}."
      elif [[ ! "${issue}" =~ ^https?:// ]] && [[ ! "${issue}" =~ ^#[0-9]+$ ]]; then
        add_error "Open technical question ${qid} has invalid issue reference '${issue}' in ${state_file}."
      fi
    fi
  done <<< "${open_questions}"
fi

if [[ "${approval_status}" == "approved" && ${open_count} -gt 0 ]]; then
  add_error "Approval Status is 'approved' but there are open technical questions in ${state_file}."
fi

if "${app_has_code}" && [[ ${open_count} -gt 0 ]]; then
  add_error "app/ contains code while open technical questions still exist in ${state_file}."
fi

###################################
# 3. Review gate: unresolved critical/warning block progression
###################################
if [[ -n "${blocking_findings}" ]]; then
  while IFS=$'\t' read -r severity scope status; do
    [[ -n "${severity}" ]] || continue
    add_error "${review_gate_file}: unresolved ${severity} finding for scope '${scope}' (status: ${status})."
  done <<< "${blocking_findings}"
fi

###################################
# 4. Invariant change trail
###################################
if [[ -n "${changed_files}" ]]; then
  if echo "${changed_files}" | grep -qx "${invariants_file}"; then
    has_trail=false
    if echo "${changed_files}" | grep -qx "${spec_history_file}"; then
      has_trail=true
    fi
    if echo "${changed_files}" | grep -qx "${arch_decisions_file}"; then
      has_trail=true
    fi

    if ! "${has_trail}"; then
      add_error "${invariants_file} changed in checked range but neither ${spec_history_file} nor ${arch_decisions_file} was updated."
    fi
  fi
fi

###################################
# 5. No unresolved placeholders in required spec files
###################################
required_specs=(
  "sdd/memory-bank/core/projectbrief.md"
)

for spec in "${required_specs[@]}"; do
  if [[ -f "${spec}" ]]; then
    if grep -Pn '(?i)\bTBD\b|\bTODO\b|<\.\.\.>' "${spec}" 2>/dev/null \
       | grep -v '<!--' | grep -v -- '-->' | head -5 | grep -q .; then
      add_error "${spec}: contains unresolved placeholders (TBD/TODO/<...>)."
    fi
  fi
done

###################################
# 6. Progress tracking for checked range
###################################
progress_file="sdd/memory-bank/core/progress.md"

if [[ -n "${changed_files}" ]]; then
  has_spec_or_code_change=false
  while IFS= read -r f; do
    case "${f}" in
      sdd/*|app/*)
        has_spec_or_code_change=true
        break
        ;;
    esac
  done <<< "${changed_files}"

  if "${has_spec_or_code_change}"; then
    if ! echo "${changed_files}" | grep -qx "${progress_file}"; then
      add_error "Spec/code files changed in checked range but ${progress_file} was not updated."
    fi
  fi
fi

###################################
# Report
###################################
if [[ "${#errors[@]}" -gt 0 ]]; then
  echo "Policy check errors:"
  for m in "${errors[@]}"; do
    echo "- ${m}"
  done
  echo
  echo "Policy check: FAIL"
  exit 1
fi

echo "Policy check: OK"
exit 0
