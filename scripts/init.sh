#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# spectra init — Set up Spectra in any project
# ─────────────────────────────────────────────

VERSION="1.0.0"
REPO_URL="https://github.com/yunusakin/spectra"

# ── Colors ──────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
NC='\033[0m' # No Color

# ── Helpers ─────────────────────────────────
info()    { echo -e "  ${GREEN}✅${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "  ${RED}✖${NC}  $1" >&2; }
step()    { echo -e "\n  ${PURPLE}──${NC} ${WHITE}$1${NC} ${PURPLE}──${NC}"; }
ask()     { echo -en "  ${CYAN}?${NC} $1"; }

banner() {
  echo ""
  echo -e "  ${PURPLE}🎨 spectra${NC} ${DIM}v${VERSION}${NC}"
  echo ""
}

# ── Determine source directory ──────────────
find_source_dir() {
  # If running from within the Spectra repo, use it directly
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # Check if we're in the Spectra repo (parent has sdd/ and docs/)
  local repo_root="${script_dir%/scripts}"
  if [[ -d "$repo_root/sdd" && -d "$repo_root/docs" && -f "$repo_root/README.md" ]]; then
    SPECTRA_SOURCE="$repo_root"
    return 0
  fi

  # Not running from repo — need to clone
  local tmp_dir
  tmp_dir=$(mktemp -d 2>/dev/null || mktemp -d -t 'spectra')
  SPECTRA_SOURCE="$tmp_dir/spectra"
  CLEANUP_DIR="$tmp_dir"

  echo -e "  ${DIM}Downloading Spectra from GitHub...${NC}"
  if command -v git &>/dev/null; then
    git clone --quiet --depth 1 "$REPO_URL" "$SPECTRA_SOURCE" 2>/dev/null
  else
    error "git is required but not found. Install git or run from the Spectra repo."
    exit 1
  fi
  info "Downloaded Spectra"
}

# ── Cleanup on exit ──────────────────────────
cleanup() {
  if [[ -n "${CLEANUP_DIR:-}" && -d "${CLEANUP_DIR:-}" ]]; then
    rm -rf "$CLEANUP_DIR"
  fi
}
trap cleanup EXIT

# ── Copy directory (skip existing) ──────────
copy_dir() {
  local src="$1"
  local dst="$2"
  local label="$3"
  local count=0

  if [[ ! -d "$src" ]]; then
    warn "Source not found: $src (skipped)"
    return
  fi

  # Count files
  count=$(find "$src" -type f | wc -l | tr -d ' ')

  # Copy preserving structure, skip existing files
  find "$src" -type f | while IFS= read -r file; do
    local rel="${file#$src/}"
    local target="$dst/$rel"
    local target_dir
    target_dir=$(dirname "$target")

    mkdir -p "$target_dir"
    if [[ ! -f "$target" ]]; then
      cp "$file" "$target"
    fi
  done

  info "$label ${DIM}($count files)${NC}"
}

# ── Copy file (skip existing) ───────────────
copy_file() {
  local src="$1"
  local dst="$2"
  local label="$3"

  if [[ ! -f "$src" ]]; then
    return
  fi

  if [[ -f "$dst" ]]; then
    warn "$label ${DIM}(exists, skipped)${NC}"
  else
    local dst_dir
    dst_dir=$(dirname "$dst")
    mkdir -p "$dst_dir"
    cp "$src" "$dst"
    info "$label"
  fi
}

# ── Merge .gitignore ────────────────────────
merge_gitignore() {
  local src="$1"
  local dst="$2"

  if [[ ! -f "$src" ]]; then
    return
  fi

  if [[ ! -f "$dst" ]]; then
    cp "$src" "$dst"
    info ".gitignore"
  else
    # Append entries that don't already exist
    local added=0
    while IFS= read -r line; do
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      if ! grep -qxF "$line" "$dst" 2>/dev/null; then
        echo "$line" >> "$dst"
        added=$((added + 1))
      fi
    done < "$src"
    if [[ $added -gt 0 ]]; then
      info ".gitignore ${DIM}(merged $added entries)${NC}"
    else
      info ".gitignore ${DIM}(already up to date)${NC}"
    fi
  fi
}

# ── Wizard: Pre-fill project info ───────────
run_wizard() {
  local target="$1"

  step "Step 3/3: Quick Start ${DIM}(optional)${NC}"
  echo ""
  ask "Pre-fill basic project info so your agent starts faster? (y/N): "
  read -r do_wizard
  echo ""

  if [[ ! "$do_wizard" =~ ^[yY]$ ]]; then
    echo -e "  ${DIM}Skipped. Your agent will ask everything during intake.${NC}"
    return
  fi

  # Project name
  ask "Project name: "
  read -r project_name
  project_name="${project_name:-my-project}"

  # Purpose
  ask "What does it do? (1 line): "
  read -r project_purpose
  project_purpose="${project_purpose:-TBD}"

  # App type
  echo ""
  echo -e "  ${WHITE}App type:${NC}"
  echo -e "    ${DIM}b)${NC} Backend API"
  echo -e "    ${DIM}w)${NC} Web frontend"
  echo -e "    ${DIM}f)${NC} Full-stack"
  echo -e "    ${DIM}m)${NC} Mobile"
  echo -e "    ${DIM}c)${NC} CLI"
  echo -e "    ${DIM}o)${NC} Worker/Batch"
  echo ""
  ask "Choose (b/w/f/m/c/o): "
  read -r app_type_choice

  local app_type
  case "$app_type_choice" in
    b|B) app_type="Backend API" ;;
    w|W) app_type="Web (frontend only)" ;;
    f|F) app_type="Full-stack" ;;
    m|M) app_type="Mobile" ;;
    c|C) app_type="CLI" ;;
    o|O) app_type="Worker/Batch" ;;
    *)   app_type="Other" ;;
  esac

  # Write to projectbrief.md
  local brief="$target/sdd/memory-bank/core/projectbrief.md"
  if [[ -f "$brief" ]]; then
    cat > "$brief" << EOF
# Project Brief

## Project Name
$project_name

## Purpose
$project_purpose

## App Type
$app_type

## Requirements
<!-- To be filled during intake -->

## Constraints
<!-- To be filled during intake -->
EOF
    info "projectbrief.md pre-filled"
  fi

  local today
  today=$(date +%Y-%m-%d)

  # Update intake-state.md
  local intake="$target/sdd/memory-bank/core/intake-state.md"
  if [[ -f "$intake" ]]; then
    cat > "$intake" << EOF
# Intake State

## Current Phase
Phase 1b (Language / Framework / Architecture)

## Phase Completion
- [x] Phase 1a: Project Basics (pre-filled via spectra init)
- [ ] Phase 1b: Language / Framework / Architecture
- [ ] Phase 1c: Data / Deployment / API Style
- [ ] Phase 2: Type-specific follow-ups
- [ ] Phase 3: Advanced (optional)

## Missing Mandatory Answers
- Primary language
- Framework
- Architecture style
- Primary data store
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
$today (pre-filled via spectra init)
EOF
    info "intake-state.md → Phase 1a complete"
  fi


  # Update activeContext.md
  local active_context="$target/sdd/memory-bank/core/activeContext.md"
  if [[ -f "$active_context" ]]; then
    cat > "$active_context" << EOF
# Active Context

> Auto-maintained by the agent. Read this first when resuming work.
>
> This file is project-bound: it must describe the target application being built with Spectra.

## Project Binding
- Project Name: $project_name
- Project Root: `$target`
- Repository: not set (update after git remote is configured)
- Branch: main
- Primary Owner: project team

## Current Focus
- Current Phase: intake
- Current Objective: complete intake and validation for $project_name
- Current Sprint Item: INTAKE-001

## State Snapshot
- Approval Status: not approved
- Intake Phase: Phase 1b (Language / Framework / Architecture)
- Open Technical Questions: none
- Unresolved Review Findings: none
- Last Validation Result: pending

## Recent Changes
| Date | Project File/Area | Change | Why |
|------|--------------------|--------|-----|
| $today | `sdd/memory-bank/core/projectbrief.md` | Pre-filled project basics | Bootstrap target project context |
| $today | `sdd/memory-bank/core/intake-state.md` | Marked Phase 1a complete | Start intake from Phase 1b quickly |

## Open Decisions
| ID | Decision Needed | Options | Owner | Due Date | Blocking |
|----|------------------|---------|-------|----------|----------|
| - | none | - | - | - | no |

## Next Actions
1. Complete Phase 1b mandatory intake answers.
2. Run `bash scripts/validate-repo.sh --strict`.
3. Resolve open technical questions and request `approved`.

## Session Boundary
- Last Updated: $today
- Resume From: intake phase
- Handoff Notes: initialized by spectra init wizard with project basics.
EOF
    info "activeContext.md pre-filled"
  fi

  # Update progress.md
  local progress="$target/sdd/memory-bank/core/progress.md"
  if [[ -f "$progress" ]]; then
    cat > "$progress" << EOF
# Progress

> Auto-maintained by the agent.
>
> This file is project-bound: it tracks execution progress for the target application built with Spectra.

## Project Binding
- Project Name: $project_name
- Project Root: `$target`
- Repository: not set (update after git remote is configured)
- Branch: main
- Sprint/Iteration: INTAKE-001

## Progress Summary
- Overall Status: on-track
- Completion: 10%
- Current Milestone: complete mandatory intake answers
- Next Milestone: validation pass and approval gate

## Work Log
| Date | Item ID | Area | Change | Status | Evidence |
|------|---------|------|--------|--------|----------|
| $today | INTAKE-001 | `projectbrief.md` | Project name, purpose, and app type pre-filled | done | `sdd/memory-bank/core/projectbrief.md` |
| $today | INTAKE-002 | `intake-state.md` | Phase 1a marked complete | done | `sdd/memory-bank/core/intake-state.md` |

## Completed
| Item ID | Description | Specs Updated | Code/Test Links | Done Date |
|---------|-------------|---------------|-----------------|-----------|
| INTAKE-001 | Bootstrap project basics via spectra init wizard | yes | `sdd/memory-bank/core/projectbrief.md` | $today |
| INTAKE-002 | Move intake start point to Phase 1b | yes | `sdd/memory-bank/core/intake-state.md` | $today |

## In Progress
| Item ID | Description | Owner | Blockers | Next Checkpoint |
|---------|-------------|-------|----------|-----------------|
| INTAKE-003 | Complete mandatory Phase 1b and 1c questions | agent + human | none | run `bash scripts/validate-repo.sh --strict` |

## Blocked
| Item ID | Blocker | Decision Needed | Owner | ETA |
|---------|---------|-----------------|-------|-----|
| - | - | - | - | - |

## Next Actions
1. Fill missing mandatory intake answers.
2. Run validation and policy checks.
3. Request approval only after open technical questions are resolved.

## Validation Snapshot
- `validate-repo.sh --strict`: pending
- `check-policy.sh`: pending
- tests/build: not applicable at intake stage

## Session Boundary
- Last Updated: $today
- Resume From: intake completion
- Handoff Notes: context and progress now track the target project, not Spectra framework maintenance.
EOF
    info "progress.md pre-filled"
  fi

  echo ""
  info "Basic info saved. Agent will continue from Phase 1b."
}

# ── Main ────────────────────────────────────
main() {
  local target="${1:-.}"

  # Resolve to absolute path
  target="$(cd "$target" 2>/dev/null && pwd)" || {
    mkdir -p "$1"
    target="$(cd "$1" && pwd)"
  }

  banner

  # ── Step 1: Validate ──────────────────────
  step "Step 1/3: Setup"

  # Check if target already has Spectra
  if [[ -d "$target/sdd/.agent/rules" ]]; then
    warn "Spectra is already installed in this directory."
    ask "Reinstall? Missing files will be added, existing files kept. (y/N): "
    read -r reinstall
    if [[ ! "$reinstall" =~ ^[yY]$ ]]; then
      echo -e "\n  ${DIM}Cancelled.${NC}\n"
      exit 0
    fi
  fi

  info "Target: ${DIM}$target${NC}"
  find_source_dir
  info "Source: ${DIM}$SPECTRA_SOURCE${NC}"

  # ── Step 2: Copy files ────────────────────
  step "Step 2/3: Copy Files"

  # Core directories
  copy_dir "$SPECTRA_SOURCE/sdd"     "$target/sdd"     "sdd/"
  copy_dir "$SPECTRA_SOURCE/scripts" "$target/scripts"  "scripts/"
  copy_dir "$SPECTRA_SOURCE/docs"    "$target/docs"     "docs/"


  # GitHub workflows
  copy_dir "$SPECTRA_SOURCE/.github" "$target/.github"  ".github/"

  # Config files
  copy_file "$SPECTRA_SOURCE/AGENT.md"       "$target/AGENT.md"       "AGENT.md"
  copy_file "$SPECTRA_SOURCE/AGENTS.md"      "$target/AGENTS.md"      "AGENTS.md"
  copy_file "$SPECTRA_SOURCE/CLAUDE.md"      "$target/CLAUDE.md"      "CLAUDE.md"
  copy_file "$SPECTRA_SOURCE/.cursorrules"   "$target/.cursorrules"   ".cursorrules"
  copy_file "$SPECTRA_SOURCE/.editorconfig"  "$target/.editorconfig"  ".editorconfig"
  copy_file "$SPECTRA_SOURCE/CHANGELOG.md"   "$target/CHANGELOG.md"   "CHANGELOG.md"
  copy_file "$SPECTRA_SOURCE/RELEASE_SUMMARY.md" "$target/RELEASE_SUMMARY.md" "RELEASE_SUMMARY.md"
  copy_file "$SPECTRA_SOURCE/LICENSE"        "$target/LICENSE"        "LICENSE"

  # Merge .gitignore
  merge_gitignore "$SPECTRA_SOURCE/.gitignore" "$target/.gitignore"

  # ── Step 3: Wizard ────────────────────────
  run_wizard "$target"

  # ── Done ──────────────────────────────────
  echo ""
  step "Done!"
  echo ""
  echo -e "  ${GREEN}📁 Spectra installed in:${NC} $target"
  echo ""
  echo -e "  ${WHITE}Next steps:${NC}"
  echo -e "    1. Open this project in ${CYAN}Cursor${NC} or ${CYAN}VS Code${NC}"
  echo -e "    2. Tell your AI agent: ${WHITE}\"init\"${NC}"
  echo -e "    3. Follow the intake flow"
  echo ""
  echo -e "  ${DIM}📖 Docs: docs/quick-start.md${NC}"
  echo -e "  ${DIM}🌐 ${REPO_URL}${NC}"
  echo ""
}

main "$@"
