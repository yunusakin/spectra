#!/usr/bin/env bash
set -euo pipefail

# health-check.sh — One-command project health overview for Spectra projects.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ok()   { printf "${GREEN}✅${NC} %-22s %s\n" "$1" "$2"; }
warn() { printf "${YELLOW}⚠️${NC}  %-22s %s\n" "$1" "$2"; }
fail() { printf "${RED}❌${NC} %-22s %s\n" "$1" "$2"; }

echo ""
echo "Spectra Health Report"
echo "======================="
echo ""

# 1. Intake status
intake_state="sdd/memory-bank/core/intake-state.md"
if [[ -f "${intake_state}" ]]; then
  # Check if it has real content (not just template)
  real_content=$(grep -v '^#\|^>\|^$\|^<!--\|^-->' "${intake_state}" 2>/dev/null | grep -v '^\s*$' | head -1 || true)
  if [[ -n "${real_content}" ]]; then
    phase=$(grep -i 'current phase' "${intake_state}" 2>/dev/null | head -1 | sed 's/.*: *//' || echo "unknown")
    ok "Intake:" "Active (${phase})"
  else
    warn "Intake:" "Template only — run 'init' to start"
  fi
else
  fail "Intake:" "intake-state.md not found"
fi

# 2. Approval status
if [[ -f "${intake_state}" ]] && grep -qi 'approved' "${intake_state}" 2>/dev/null; then
  ok "Approval:" "Approved"
elif [[ -d "app" ]] && find app -type f ! -name 'README.md' | head -1 | grep -q .; then
  warn "Approval:" "app/ has code but no approval evidence"
else
  warn "Approval:" "Not yet approved"
fi

# 3. Sprint status
sprint_current="sdd/memory-bank/core/sprint-current.md"
if [[ -f "${sprint_current}" ]]; then
  done_count=$(grep -c '^\- \[x\]\|^- .*Done' "${sprint_current}" 2>/dev/null || echo "0")
  backlog_count=$(grep -c '^\- ' "${sprint_current}" 2>/dev/null || echo "0")
  real_sprint=$(grep -v '^#\|^>\|^$\|^<!--\|^-->' "${sprint_current}" 2>/dev/null | grep -v '^\s*$' | head -1 || true)
  if [[ -n "${real_sprint}" ]]; then
    ok "Sprint:" "Active (${done_count} items tracked)"
  else
    warn "Sprint:" "Template only — not started"
  fi
else
  warn "Sprint:" "sprint-current.md not found"
fi

# 4. Progress freshness
progress="sdd/memory-bank/core/progress.md"
if [[ -f "${progress}" ]]; then
  real_progress=$(grep -v '^#\|^>\|^$\|^<!--\|^-->' "${progress}" 2>/dev/null | grep -v '^\s*$' | head -1 || true)
  if [[ -n "${real_progress}" ]]; then
    if git log -1 --format="%ar" -- "${progress}" 2>/dev/null | grep -q .; then
      last_update=$(git log -1 --format="%ar" -- "${progress}" 2>/dev/null)
      ok "Progress:" "Updated ${last_update}"
    else
      ok "Progress:" "Has content"
    fi
  else
    warn "Progress:" "Template only — not populated"
  fi
else
  fail "Progress:" "progress.md not found"
fi

# 5. Traceability
traceability="sdd/memory-bank/core/traceability.md"
if [[ -f "${traceability}" ]]; then
  mapped=$(grep -cE '✅|🔄|Done|In progress' "${traceability}" 2>/dev/null || echo "0")
  total=$(grep -cE '^\| [0-9]' "${traceability}" 2>/dev/null || echo "0")
  if [[ "${total}" -gt 0 ]]; then
    ok "Traceability:" "${mapped}/${total} features mapped"
  else
    warn "Traceability:" "Template only — no features mapped"
  fi
else
  warn "Traceability:" "traceability.md not found"
fi

# 6. Active Context
active_ctx="sdd/memory-bank/core/activeContext.md"
if [[ -f "${active_ctx}" ]]; then
  real_ctx=$(grep -v '^#\|^>\|^$\|^<!--\|^-->' "${active_ctx}" 2>/dev/null | grep -v '^\s*$' | head -1 || true)
  if [[ -n "${real_ctx}" ]]; then
    ok "Active Context:" "Populated"
  else
    warn "Active Context:" "Template only"
  fi
else
  warn "Active Context:" "activeContext.md not found"
fi

# 7. Tests
if [[ -d "app" ]]; then
  test_files=$(find app -type f \( -name '*test*' -o -name '*spec*' -o -path '*/tests/*' -o -path '*/test/*' \) 2>/dev/null | wc -l | tr -d ' ')
  if [[ "${test_files}" -gt 0 ]]; then
    ok "Tests:" "${test_files} test file(s) found"
  else
    fail "Tests:" "No test files found under app/"
  fi
else
  warn "Tests:" "No app/ directory yet"
fi

# 8. Spec freshness
brief="sdd/memory-bank/core/projectbrief.md"
if [[ -f "${brief}" ]] && git log -1 --format="%ar" -- "${brief}" 2>/dev/null | grep -q .; then
  spec_age=$(git log -1 --format="%ar" -- "${brief}" 2>/dev/null)
  ok "Spec Freshness:" "projectbrief.md updated ${spec_age}"
else
  warn "Spec Freshness:" "Cannot determine (no git history or file missing)"
fi

# 9. Validation
if bash scripts/validate-repo.sh >/dev/null 2>&1; then
  ok "Validation:" "validate-repo.sh passes"
else
  fail "Validation:" "validate-repo.sh has errors"
fi

echo ""
