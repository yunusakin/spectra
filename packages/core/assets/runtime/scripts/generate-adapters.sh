#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/generate-adapters.sh --agents <csv> [--target <root>]

Generates agent-specific instruction files from Spectra's canonical system files.

Options:
  --agents <csv>   Comma-separated list: claude,cursor,windsurf,copilot,codex,antigravity
  --target <root>  Target repository root (default: current repository root)
  -h, --help       Show help
USAGE
}

AGENTS_CSV=""
TARGET_ROOT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents)
      AGENTS_CSV="${2:-}"
      shift 2
      ;;
    --target)
      TARGET_ROOT="${2:-}"
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

if [[ -z "${AGENTS_CSV}" ]]; then
  echo "Error: --agents is required." >&2
  usage
  exit 2
fi

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_runtime.sh"

REPO_ROOT="${SPECTRA_REPO_ROOT}"
TARGET_ROOT="${TARGET_ROOT:-${REPO_ROOT}}"
mkdir -p "${TARGET_ROOT}"
TARGET_ROOT="$(cd "${TARGET_ROOT}" && pwd)"

manifest_file="${REPO_ROOT}/sdd/system/manifest.env"
common_file="${REPO_ROOT}/sdd/system/adapters/common-instructions.md"
ignore_file="${REPO_ROOT}/sdd/system/adapters/ignore-patterns.txt"

if [[ ! -f "${manifest_file}" || ! -f "${common_file}" || ! -f "${ignore_file}" ]]; then
  echo "Error: missing canonical adapter inputs under sdd/system/adapters." >&2
  exit 1
fi

repo_mode="$(awk -F= '$1=="repo_mode" { print $2 }' "${manifest_file}" 2>/dev/null | tail -1)"
if [[ "${TARGET_ROOT}" == "${REPO_ROOT}" && "${repo_mode}" == "canonical" ]]; then
  echo "Error: refusing to generate adapters into the canonical Spectra repository root." >&2
  echo "Use --target <consumer-repo> or a temp directory." >&2
  exit 1
fi

normalize_csv() {
  echo "$1" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | awk 'NF > 0' | awk '!seen[$0]++'
}

common_body="$(cat "${common_file}")"
ignore_lines="$(sed 's/^/- `/;s/$/`/' "${ignore_file}")"

render_common_block() {
  local tool_name="$1"
  cat <<EOF
${common_body}

## Tool Notes

- Target: ${tool_name}
- Bootstrap context: \`spectra ctx --role planner --goal discover\`
- Intake context: \`spectra ctx --role planner --goal decide\`
- Verification gate: \`spectra ver\`

## Ignore Guidance
${ignore_lines}
EOF
}

write_file() {
  local path="$1"
  mkdir -p "$(dirname "${path}")"
  cat > "${path}"
}

while IFS= read -r agent; do
  case "${agent}" in
    claude)
      render_common_block "Claude Code" | write_file "${TARGET_ROOT}/CLAUDE.md"
      ;;
    cursor)
      cat <<EOF | write_file "${TARGET_ROOT}/.cursor/rules/spectra-core.mdc"
# Spectra Core

$(render_common_block "Cursor")
EOF
      cat <<EOF | write_file "${TARGET_ROOT}/.cursor/rules/spectra-workflow.mdc"
# Spectra Workflow

- Preferred compact context: \`spectra ctx --role implementer --goal implement\`
- Use \`spectra ver --scope app\` before marking implementation ready.
EOF
      cat <<EOF | write_file "${TARGET_ROOT}/.cursor/rules/spectra-context.mdc"
# Spectra Context Routing

- Ask Spectra for role/goal context with \`spectra ctx --role <role> --goal <goal>\`.
- Do not preload unrelated files when a pack exists.
EOF
      ;;
    windsurf)
      cat <<EOF | write_file "${TARGET_ROOT}/.windsurf/rules/spectra-core.md"
# Spectra Core

$(render_common_block "Windsurf")
EOF
      cat <<EOF | write_file "${TARGET_ROOT}/.windsurf/rules/spectra-workflow.md"
# Spectra Workflow

- Run \`spectra task --item <id> --task-type <type> --goal "<goal>"\` before post-approval coding.
- Run \`spectra ver --scope app\` before handoff.
EOF
      cat <<EOF | write_file "${TARGET_ROOT}/.windsurf/rules/spectra-context.md"
# Spectra Context

- Resolve the required pack with \`spectra ctx --role <role> --goal <goal>\`.
EOF
      ;;
    copilot)
      cat <<EOF | write_file "${TARGET_ROOT}/.github/copilot-instructions.md"
# Spectra Copilot Instructions

$(render_common_block "GitHub Copilot")
EOF
      ;;
    codex)
      cat <<EOF | write_file "${TARGET_ROOT}/AGENTS.md"
# Spectra Adapter (Codex)

$(render_common_block "Codex")
EOF
      ;;
    antigravity)
      cat <<EOF | write_file "${TARGET_ROOT}/.agent/rules/spectra-core.md"
# Spectra Core

$(render_common_block "Antigravity")
EOF
      cat <<EOF | write_file "${TARGET_ROOT}/.agent/rules/spectra-workflow.md"
# Spectra Workflow

- Use \`spectra task --item <id> --task-type <type> --goal "<goal>"\` before implementation work.
- Use \`spectra ver\` before marking work complete.
EOF
      cat <<EOF | write_file "${TARGET_ROOT}/.agent/rules/spectra-context.md"
# Spectra Context

- Resolve task context via \`spectra ctx --role <role> --goal <goal>\`.
EOF
      ;;
    *)
      echo "Error: unsupported agent '${agent}'." >&2
      exit 2
      ;;
  esac
done < <(normalize_csv "${AGENTS_CSV}")

echo "Adapter generation: OK"
