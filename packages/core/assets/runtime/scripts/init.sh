#!/usr/bin/env bash
set -euo pipefail

VERSION="2.0.0"
REPO_URL="https://github.com/yunusakin/spectra"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "  ${GREEN}OK${NC} $1"; }
warn()    { echo -e "  ${YELLOW}WARN${NC} $1"; }
error()   { echo -e "  ${RED}FAIL${NC} $1" >&2; }
step()    { echo -e "\n  ${PURPLE}--${NC} ${WHITE}$1${NC} ${PURPLE}--${NC}"; }
ask()     { echo -en "  ${CYAN}?${NC} $1"; }

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/init.sh [target] [--agents <csv>] [--adopt]

Options:
  target           Consumer repository root (default: current directory)
  --agents <csv>   Generate adapters for claude,cursor,windsurf,copilot,codex,antigravity
  --adopt          Run brownfield discovery after install
  -h, --help       Show help
USAGE
}

TARGET_ARG="."
AGENTS_CSV=""
ADOPT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents)
      AGENTS_CSV="${2:-}"
      shift 2
      ;;
    --adopt)
      ADOPT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "${TARGET_ARG}" == "." ]]; then
        TARGET_ARG="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage
        exit 2
      fi
      ;;
  esac
done

banner() {
  echo ""
  echo -e "  ${PURPLE}spectra${NC} ${DIM}v${VERSION}${NC}"
  echo ""
}

find_source_dir() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local repo_root="${script_dir%/scripts}"

  if [[ -d "${repo_root}/sdd/system" && -d "${repo_root}/docs" && -f "${repo_root}/README.md" ]]; then
    SPECTRA_SOURCE="${repo_root}"
    return 0
  fi

  error "Run init.sh from the Spectra repository checkout."
  exit 1
}

copy_dir() {
  local src="$1"
  local dst="$2"
  local label="$3"
  local count=0

  [[ -d "${src}" ]] || return 0
  count="$(find "${src}" -type f | wc -l | tr -d ' ')"

  find "${src}" -type f | while IFS= read -r file; do
    local rel="${file#${src}/}"
    local target="${dst}/${rel}"
    mkdir -p "$(dirname "${target}")"
    if [[ ! -f "${target}" ]]; then
      cp "${file}" "${target}"
    fi
  done

  info "${label} ${DIM}(${count} files)${NC}"
}

copy_file() {
  local src="$1"
  local dst="$2"
  local label="$3"

  [[ -f "${src}" ]] || return 0
  if [[ -f "${dst}" ]]; then
    warn "${label} ${DIM}(exists, skipped)${NC}"
    return 0
  fi

  mkdir -p "$(dirname "${dst}")"
  cp "${src}" "${dst}"
  info "${label}"
}

merge_gitignore() {
  local src="$1"
  local dst="$2"

  [[ -f "${src}" ]] || return 0
  if [[ ! -f "${dst}" ]]; then
    cp "${src}" "${dst}"
    info ".gitignore"
    return 0
  fi

  local added=0
  while IFS= read -r line; do
    [[ -z "${line}" || "${line}" =~ ^# ]] && continue
    if ! grep -qxF "${line}" "${dst}" 2>/dev/null; then
      echo "${line}" >> "${dst}"
      added=$((added + 1))
    fi
  done < "${src}"

  if [[ ${added} -gt 0 ]]; then
    info ".gitignore ${DIM}(merged ${added} entries)${NC}"
  else
    info ".gitignore ${DIM}(already up to date)${NC}"
  fi
}

prefill_projectbrief() {
  local brief="$1"
  local project_name="$2"
  local purpose="$3"
  local app_type="$4"

  cat > "${brief}" <<EOF
# Project Brief

> Filled by intake.

## Project Name
${project_name}

## Purpose
${purpose}

## App Type
${app_type}

## Product Context
> Filled by intake.

## Requirements
> Filled by intake.

## Constraints
> Filled by intake.
EOF
}

prefill_intake_state() {
  local intake="$1"
  local notes="$2"

  cat > "${intake}" <<EOF
# Intake State

> Auto-filled by intake. Used to resume if intake is interrupted.

## Current Phase
Phase 1 (Core)

## Phase Completion
- [ ] Phase 1 (Core)
- [ ] Phase 2 (Type-specific)
- [ ] Phase 2b (API-style)
- [ ] Phase 3 (Advanced, optional)

## Missing Mandatory Answers
- Primary language + version
- Framework + version (or none)
- Architecture style
- Primary data store + version (or none)
- Deployment target
- API style

## Validation Errors
- (none)

## Approval Status
not approved

## Decision Log
| Date | Question ID | Decision | Confirmation | Notes |
|---|---|---|---|---|

## Open Technical Questions
| Question ID | Question | Status | Issue | Owner | Notes |
|---|---|---|---|---|---|

## Last Updated
$(date +%Y-%m-%d)

## Discovered Signals
- (none)

## Notes
${notes}
EOF
}

run_wizard() {
  local target="$1"
  local brief="${target}/sdd/memory-bank/core/projectbrief.md"
  local intake="${target}/sdd/memory-bank/core/intake-state.md"

  step "Step 3/4: Quick Start ${DIM}(optional)${NC}"
  echo ""
  ask "Pre-fill basic project info so intake starts with project basics? (y/N): "
  local do_wizard
  read -r do_wizard
  echo ""

  if [[ ! "${do_wizard}" =~ ^[yY]$ ]]; then
    warn "Skipped quick prefill."
    return 0
  fi

  ask "Project name: "
  local project_name
  read -r project_name
  project_name="${project_name:-my-project}"

  ask "What does it do? (1 line): "
  local project_purpose
  read -r project_purpose
  project_purpose="${project_purpose:-To be defined during intake}"

  echo ""
  echo -e "  ${WHITE}App type:${NC}"
  echo -e "    ${DIM}b)${NC} Backend API"
  echo -e "    ${DIM}w)${NC} Web frontend"
  echo -e "    ${DIM}f)${NC} Full-stack"
  echo -e "    ${DIM}m)${NC} Mobile"
  echo -e "    ${DIM}c)${NC} CLI"
  echo -e "    ${DIM}o)${NC} Worker/Batch"
  echo -e "    ${DIM}l)${NC} Library"
  echo ""
  ask "Choose (b/w/f/m/c/o/l): "
  local app_type_choice
  read -r app_type_choice

  local app_type="Other"
  case "${app_type_choice}" in
    b|B) app_type="Backend API" ;;
    w|W) app_type="Web frontend" ;;
    f|F) app_type="Full-stack" ;;
    m|M) app_type="Mobile" ;;
    c|C) app_type="CLI" ;;
    o|O) app_type="Worker/Batch" ;;
    l|L) app_type="Library" ;;
  esac

  prefill_projectbrief "${brief}" "${project_name}" "${project_purpose}" "${app_type}"
  prefill_intake_state "${intake}" "- Basic project identity was pre-filled by init.sh."

  info "projectbrief.md pre-filled"
  info "intake-state.md pre-filled"
}

collect_discovery_signals() {
  local discovery_dir="$1"
  local emitted=0
  local file line

  for file in stack.md architecture.md structure.md conventions.md testing.md integrations.md concerns.md; do
    [[ -f "${discovery_dir}/${file}" ]] || continue
    while IFS= read -r line; do
      [[ "${line}" == "- "* ]] || continue
      printf '%s\n' "- \`${file}\`: ${line#- }"
      emitted=1
      break
    done < "${discovery_dir}/${file}"
  done

  if [[ ${emitted} -eq 0 ]]; then
    printf '%s\n' "- No strong discovery signals detected yet."
  fi
}

annotate_intake_with_discovery() {
  local intake="$1"
  local discovery_dir="$2"
  local signals
  local tmp_file
  local signals_file

  signals="$(collect_discovery_signals "${discovery_dir}")"
  signals_file="$(mktemp 2>/dev/null)" || signals_file="${intake}.signals.tmp"
  printf '%s\n' "${signals}" > "${signals_file}"

  tmp_file="$(mktemp 2>/dev/null)" || tmp_file="${intake}.tmp"
  awk -v signals_file="${signals_file}" '
    function print_file(path, line) {
      while ((getline line < path) > 0) {
        print line
      }
      close(path)
    }
    BEGIN {
      in_discovered = 0
      in_notes = 0
    }
    /^## Discovered Signals$/ {
      print
      print_file(signals_file)
      in_discovered = 1
      next
    }
    /^## Notes$/ {
      print
      print "- Brownfield discovery snapshot generated by `map-codebase.sh`."
      print "- Review `sdd/memory-bank/discovery/` before confirming technical choices."
      print "- Treat discovery findings as unconfirmed until explicitly confirmed."
      in_notes = 1
      next
    }
    /^## / {
      in_discovered = 0
      in_notes = 0
      print
      next
    }
    {
      if (in_discovered || in_notes) next
      print
    }
  ' "${intake}" > "${tmp_file}"
  mv "${tmp_file}" "${intake}"
  rm -f "${signals_file}"
}

main() {
  local target="${TARGET_ARG}"
  target="$(cd "${target}" 2>/dev/null && pwd)" || {
    mkdir -p "${target}"
    target="$(cd "${target}" && pwd)"
  }

  banner
  find_source_dir

  step "Step 1/4: Setup"
  if [[ -d "${target}/sdd/system/rules" ]]; then
    warn "Spectra already appears installed in this directory."
    ask "Reinstall core files? Missing files will be added, existing files kept. (y/N): "
    local reinstall
    read -r reinstall
    if [[ ! "${reinstall}" =~ ^[yY]$ ]]; then
      echo -e "\n  ${DIM}Cancelled.${NC}\n"
      exit 0
    fi
  fi

  info "Target: ${DIM}${target}${NC}"
  info "Source: ${DIM}${SPECTRA_SOURCE}${NC}"

  if [[ ${ADOPT} -eq 1 ]]; then
    step "Brownfield Discovery"
    bash "${SPECTRA_SOURCE}/scripts/map-codebase.sh" --root "${target}"
  fi

  step "Step 2/4: Copy Files"
  copy_dir "${SPECTRA_SOURCE}/sdd" "${target}/sdd" "sdd/"
  copy_dir "${SPECTRA_SOURCE}/scripts" "${target}/scripts" "scripts/"
  copy_dir "${SPECTRA_SOURCE}/docs" "${target}/docs" "docs/"
  copy_dir "${SPECTRA_SOURCE}/.github" "${target}/.github" ".github/"
  copy_file "${SPECTRA_SOURCE}/.editorconfig" "${target}/.editorconfig" ".editorconfig"
  copy_file "${SPECTRA_SOURCE}/CHANGELOG.md" "${target}/CHANGELOG.md" "CHANGELOG.md"
  copy_file "${SPECTRA_SOURCE}/RELEASE_SUMMARY.md" "${target}/RELEASE_SUMMARY.md" "RELEASE_SUMMARY.md"
  copy_file "${SPECTRA_SOURCE}/LICENSE" "${target}/LICENSE" "LICENSE"
  merge_gitignore "${SPECTRA_SOURCE}/.gitignore" "${target}/.gitignore"

  if [[ -f "${target}/sdd/system/manifest.env" ]]; then
    perl -0pi -e 's/^repo_mode=.*/repo_mode=consumer/m' "${target}/sdd/system/manifest.env"
  fi

  step "Step 4/4: Optional Extras"
  run_wizard "${target}"

  if [[ ${ADOPT} -eq 1 ]]; then
    annotate_intake_with_discovery "${target}/sdd/memory-bank/core/intake-state.md" "${target}/sdd/memory-bank/discovery"
    info "Brownfield discovery completed"
  fi

  if [[ -n "${AGENTS_CSV}" ]]; then
    bash "${target}/scripts/generate-adapters.sh" --agents "${AGENTS_CSV}" --target "${target}"
    info "Adapters generated: ${AGENTS_CSV}"
  fi

  echo ""
  step "Done"
  echo ""
  echo -e "  ${GREEN}Spectra installed in:${NC} ${target}"
  echo ""
  echo -e "  ${WHITE}Next steps:${NC}"
  echo -e "    1. Run ${CYAN}bash scripts/context-pack.sh --task bootstrap${NC}"
  echo -e "    2. Start intake with ${WHITE}init${NC}"
  echo -e "    3. Use ${CYAN}bash scripts/verify-work.sh${NC} before handoff"
  echo ""
  echo -e "  ${DIM}Docs: docs/quick-start.md${NC}"
  echo -e "  ${DIM}${REPO_URL}${NC}"
  echo ""
}

main "$@"
