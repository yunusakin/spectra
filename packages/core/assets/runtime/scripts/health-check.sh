#!/usr/bin/env bash
set -euo pipefail

# health-check.sh — One-command project health overview for Spectra projects.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_runtime.sh"

REPO_ROOT="${SPECTRA_REPO_ROOT}"
cd "${REPO_ROOT}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ok()   { printf "${GREEN}✅${NC} %-22s %s\n" "$1" "$2"; }
warn() { printf "${YELLOW}⚠️${NC}  %-22s %s\n" "$1" "$2"; }
fail() { printf "${RED}❌${NC} %-22s %s\n" "$1" "$2"; }

parse_section_value() {
  local state_file="$1"
  local section_name="$2"
  awk '
    BEGIN { in_section = 0; in_comment = 0 }
    {
      if ($0 ~ /<!--/) in_comment = 1
      if (in_comment == 1) {
        if ($0 ~ /-->/) in_comment = 0
        next
      }

      expected = "## " section
      if ($0 == expected) {
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
          print line
          exit
        }
      }
    }
  ' section="${section_name}" "${state_file}" 2>/dev/null || true
}

parse_approval_status() {
  local approval_file="sdd/governance/approval-state.yaml"
  if [[ -f "${approval_file}" ]]; then
    awk '/^current_state:[[:space:]]*/ { print tolower($2); exit }' "${approval_file}" 2>/dev/null || true
    return
  fi

  parse_section_value "$1" "Approval Status" | tr '[:upper:]' '[:lower:]'
}

echo ""
echo "Spectra Health Report"
echo "======================="
echo ""

# 1. Intake status
intake_state="sdd/memory-bank/core/intake-state.md"
if [[ -f "${intake_state}" ]]; then
  phase="$(parse_section_value "${intake_state}" "Current Phase")"
  if [[ -n "${phase}" ]]; then
    ok "Intake:" "Active (${phase})"
  else
    warn "Intake:" "Not started — Current Phase is empty"
  fi
else
  fail "Intake:" "intake-state.md not found"
fi

# 2. Approval status
approval_status="$(parse_approval_status "${intake_state}")"
if [[ "${approval_status}" == "approved" || "${approval_status}" == *"-approved" ]]; then
  ok "Approval:" "Approved (${approval_status})"
elif [[ "${approval_status}" == "draft" ]]; then
  warn "Approval:" "Draft"
else
  warn "Approval:" "Not yet approved"
fi

# 3. Sprint status
sprint_current="sdd/memory-bank/core/sprint-current.md"
if [[ -f "${sprint_current}" ]]; then
  read -r tracked_count done_count < <(
    awk '
      BEGIN { in_comment = 0; section = ""; tracked = 0; done = 0 }
      /<!--/ { in_comment = 1 }
      in_comment == 1 {
        if (/-->/) in_comment = 0
        next
      }
      /^## Sprint Backlog[[:space:]]*$/ { section = "backlog"; next }
      /^## In Progress[[:space:]]*$/ { section = "progress"; next }
      /^## Done[[:space:]]*$/ { section = "done"; next }
      /^## / { section = ""; next }
      section != "" && /^- / {
        tracked++
        if (section == "done" || $0 ~ /^- \[[xX]\]/) done++
      }
      END { print tracked, done }
    ' "${sprint_current}"
  )
  sprint_name="$(parse_section_value "${sprint_current}" "Sprint Name")"
  if [[ -n "${sprint_name}" ]]; then
    ok "Sprint:" "Active (${tracked_count} items tracked, ${done_count} done)"
  else
    warn "Sprint:" "Not started — Sprint Name is empty"
  fi
else
  warn "Sprint:" "sprint-current.md not found"
fi

# 4. Progress freshness
progress="sdd/memory-bank/core/progress.md"
if [[ -f "${progress}" ]]; then
  if grep -q '<target-project-name>\|<absolute-target-project-path>' "${progress}" 2>/dev/null; then
    warn "Progress:" "Template only — project binding is incomplete"
  else
    if git log -1 --format="%ar" -- "${progress}" 2>/dev/null | grep -q .; then
      last_update=$(git log -1 --format="%ar" -- "${progress}" 2>/dev/null)
      ok "Progress:" "Updated ${last_update}"
    else
      ok "Progress:" "Populated but not committed yet"
    fi
  fi
else
  fail "Progress:" "progress.md not found"
fi

# 5. Traceability
traceability="sdd/memory-bank/core/traceability.md"
if [[ -f "${traceability}" ]]; then
  read -r mapped total < <(
    awk '
      BEGIN { in_comment = 0; mapped = 0; total = 0 }
      /<!--/ { in_comment = 1 }
      in_comment == 1 {
        if (/-->/) in_comment = 0
        next
      }
      /^\|[[:space:]]*[0-9]+[[:space:]]*\|/ {
        total++
        if ($0 ~ /✅|🔄|Done|In progress/) mapped++
      }
      END { print mapped, total }
    ' "${traceability}"
  )
  if [[ "${total}" -gt 0 ]]; then
    ok "Traceability:" "${mapped}/${total} features mapped"
  else
    warn "Traceability:" "No requirement rows mapped yet"
  fi
else
  warn "Traceability:" "traceability.md not found"
fi

# 6. Active Context
active_ctx="sdd/memory-bank/core/activeContext.md"
if [[ -f "${active_ctx}" ]]; then
  if grep -q '<target-project-name>\|<absolute-target-project-path>' "${active_ctx}" 2>/dev/null; then
    warn "Active Context:" "Template only — project binding is incomplete"
  else
    ok "Active Context:" "Populated"
  fi
else
  warn "Active Context:" "activeContext.md not found"
fi

# 7. Tests
test_files=$(
  find . -type f \
    ! -path './.git/*' \
    ! -path './.spectra/*' \
    ! -path './sdd/*' \
    ! -path './docs/*' \
    ! -path '*/node_modules/*' \
    ! -path '*/vendor/*' \
    ! -path '*/target/*' \
    ! -path '*/build/*' \
    ! -path '*/dist/*' \
    ! -path '*/.gradle/*' \
    \( -path '*/src/test/*' -o -path '*/test/*' -o -path '*/tests/*' \
       -o -name '*.test.*' -o -name '*.spec.*' -o -name '*Test.*' -o -name '*Tests.*' \
       -o -name 'test_*.py' -o -name '*_test.*' -o -name '*_spec.*' -o -name '*IT.java' \) \
    2>/dev/null | wc -l | tr -d ' '
)
if [[ "${test_files}" -gt 0 ]]; then
  ok "Tests:" "${test_files} test file(s) found across repository"
else
  install_mode="$(awk -F'"' '/"installMode"[[:space:]]*:/ { print $4; exit }' .spectra/install.json 2>/dev/null || true)"
  if [[ "${install_mode}" == "adopt" ]]; then
    warn "Tests:" "No test files detected by repository scan"
  else
    fail "Tests:" "No test files detected in repository"
  fi
fi

# 8. Spec freshness
spec_file="$(find sdd/features -mindepth 2 -maxdepth 2 -type f -name 'feature.spec.yaml' 2>/dev/null | sort | head -1 || true)"
if [[ -z "${spec_file}" ]]; then
  spec_file="sdd/memory-bank/core/projectbrief.md"
fi

if [[ ! -f "${spec_file}" ]]; then
  fail "Spec Freshness:" "No canonical feature spec found"
elif ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  warn "Spec Freshness:" "Cannot determine outside a Git repository"
elif ! git ls-files --error-unmatch -- "${spec_file}" >/dev/null 2>&1; then
  warn "Spec Freshness:" "${spec_file} is new and not committed yet"
elif git log -1 --format="%ar" -- "${spec_file}" 2>/dev/null | grep -q .; then
  spec_age=$(git log -1 --format="%ar" -- "${spec_file}" 2>/dev/null)
  ok "Spec Freshness:" "${spec_file} updated ${spec_age}"
else
  warn "Spec Freshness:" "${spec_file} has no commit history"
fi

# 9. Validation
if run_runtime_script validate-repo.sh >/dev/null 2>&1; then
  ok "Validation:" "validate-repo.sh passes"
else
  fail "Validation:" "validate-repo.sh has errors"
fi

echo ""
