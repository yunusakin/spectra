#!/usr/bin/env bash
set -euo pipefail

# check-policy.sh — Approve-gate and progress-tracking policy checks.
# Run in CI alongside validate-repo.sh to enforce SDD Spine invariants.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

errors=()
add_error() { errors+=("$1"); }

###################################
# 1. Approval gate: no app/ code without approval evidence
###################################
if [[ -d "app" ]]; then
  # Count non-README files in app/
  app_files=$(find app -type f ! -name 'README.md' | head -1)
  if [[ -n "${app_files}" ]]; then
    state_file="sdd/memory-bank/core/intake-state.md"
    if [[ ! -f "${state_file}" ]]; then
      add_error "app/ contains code but ${state_file} does not exist."
    else
      if ! grep -qi "approved" "${state_file}" 2>/dev/null; then
        add_error "app/ contains code but ${state_file} does not show approval."
      fi
    fi
  fi
fi

###################################
# 2. No unresolved placeholders in required spec files
###################################
required_specs=(
  "sdd/memory-bank/core/projectbrief.md"
)

for spec in "${required_specs[@]}"; do
  if [[ -f "${spec}" ]]; then
    # Skip HTML comment blocks (<!-- ... -->), only check real content
    if grep -Pn '(?i)\bTBD\b|\bTODO\b|<\.\.\.>' "${spec}" 2>/dev/null \
       | grep -v '<!--' | grep -v -- '-->' | head -5 | grep -q .; then
      add_error "${spec}: contains unresolved placeholders (TBD/TODO/<...>)."
    fi
  fi
done

###################################
# 3. Progress tracking: if spec/code files changed in the current commit,
#    progress.md should also be touched.
###################################
progress_file="sdd/memory-bank/core/progress.md"

# Only check if we're in a git repo with at least one commit
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  changed_files="$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)"
  if [[ -n "${changed_files}" ]]; then
    has_spec_or_code_change=false
    while IFS= read -r f; do
      case "${f}" in
        sdd/*|app/*) has_spec_or_code_change=true; break ;;
      esac
    done <<< "${changed_files}"

    if "${has_spec_or_code_change}"; then
      if ! echo "${changed_files}" | grep -qx "${progress_file}"; then
        add_error "Spec/code files changed but ${progress_file} was not updated."
      fi
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
