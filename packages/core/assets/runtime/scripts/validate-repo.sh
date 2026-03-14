#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/validate-repo.sh [--strict]

Checks:
- Required Spectra system paths exist
- Legacy v1 agent-specific paths are absent
- Index files reference existing markdown files
- repo_mode is valid and canonical/consumer rules are enforced
- Skills metadata and dependency map are valid
- Prompts are indexed
- Context-pack manifest is well-formed
- Adapter generation is deterministic
- Consumer adapter outputs, if present, match generated content
- Markdown templates and links pass basic hygiene checks
USAGE
}

STRICT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_runtime.sh"

REPO_ROOT="${SPECTRA_REPO_ROOT}"
cd "${REPO_ROOT}"

errors=()
warns=()

add_error() { errors+=("$1"); }
add_warn() { warns+=("$1"); }

extract_backtick_tokens() {
  local file="$1"
  grep -oE '`[^`]+`' "${file}" 2>/dev/null | sed 's/^`//;s/`$//' || true
}

check_markdown_has_h1() {
  local file="$1"
  local first
  first="$(awk '
    BEGIN { in_front_matter = 0 }
    NR == 1 && $0 == "---" { in_front_matter = 1; next }
    in_front_matter == 1 {
      if ($0 == "---") {
        in_front_matter = 0
      }
      next
    }
    NF { print; exit }
  ' "${file}" 2>/dev/null || true)"
  if [[ -z "${first}" ]]; then
    add_warn "${file}: file is empty"
    return 0
  fi
  if [[ "${first}" != "# "* ]]; then
    add_warn "${file}: first non-empty line should start with '# '"
  fi
}

check_examples_inside_html_comments() {
  local file="$1"
  local lineno
  while IFS= read -r lineno; do
    [[ -n "${lineno}" ]] || continue
    add_warn "${file}:${lineno}: 'Example:' should be inside an HTML comment block"
  done < <(
    awk '
      BEGIN { inside = 0 }
      {
        if (index($0, "<!--") > 0) inside = 1
        if (index($0, "Example:") > 0 && inside == 0) print NR
        if (index($0, "-->") > 0) inside = 0
      }
    ' "${file}"
  )
}

check_index_backtick_paths() {
  local index_path="$1"
  local base_dir="$2"
  local tok
  while IFS= read -r tok; do
    [[ -n "${tok}" ]] || continue
    if [[ "${tok}" == */* && "${tok}" == *.md ]]; then
      if [[ -e "${base_dir}/${tok}" || -e "${REPO_ROOT}/${tok}" ]]; then
        continue
      fi
      add_error "${index_path}: references missing file \`${tok}\`"
    fi
  done < <(extract_backtick_tokens "${index_path}")
}

extract_front_matter_field() {
  local file="$1"
  local key="$2"
  awk -v key="${key}" '
    BEGIN { in_meta = 0 }
    NR == 1 && $0 == "---" { in_meta = 1; next }
    in_meta == 1 {
      if ($0 == "---") exit
      if ($0 ~ "^" key ":[[:space:]]*") {
        line = $0
        sub("^" key ":[[:space:]]*", "", line)
        gsub(/[[:space:]]+$/, "", line)
        print line
        exit
      }
    }
  ' "${file}" 2>/dev/null || true
}

parse_skill_front_matter() {
  local skill_md="$1"
  local out_name="$2"
  local out_desc="$3"

  local name=""
  local desc=""
  local end_found=0

  local first
  first="$(head -n 1 "${skill_md}" 2>/dev/null | tr -d '\r' || true)"
  if [[ "${first}" != "---" ]]; then
    add_error "${skill_md}: missing YAML front matter (expected leading '---')"
    printf '%s\n' "" > "${out_name}"
    printf '%s\n' "" > "${out_desc}"
    return 0
  fi

  local in_meta=0
  local lineno=0
  local line key val
  while IFS= read -r line || [[ -n "${line}" ]]; do
    lineno=$((lineno + 1))
    line="${line%$'\r'}"
    if [[ "${in_meta}" -eq 0 ]]; then
      if [[ "${lineno}" -eq 1 ]]; then
        in_meta=1
      fi
      continue
    fi
    if [[ "${line}" == "---" ]]; then
      end_found=1
      break
    fi
    [[ -n "${line}" ]] || continue
    if [[ "${line}" != *:* ]]; then
      add_warn "${skill_md}:${lineno}: malformed front matter line"
      continue
    fi
    key="${line%%:*}"
    val="${line#*:}"
    key="$(echo "${key}" | xargs)"
    val="$(echo "${val}" | xargs)"
    case "${key}" in
      name) name="${val}" ;;
      description) desc="${val}" ;;
    esac
  done < "${skill_md}"

  if [[ "${end_found}" -eq 0 ]]; then
    add_error "${skill_md}: YAML front matter not closed"
  fi
  [[ -n "${name}" ]] || add_error "${skill_md}: front matter missing \`name\`"
  [[ -n "${desc}" ]] || add_error "${skill_md}: front matter missing \`description\`"

  printf '%s\n' "${name}" > "${out_name}"
  printf '%s\n' "${desc}" > "${out_desc}"
}

check_skill_dependency_map() {
  local map_file="$1"
  local skills_dir="$2"

  [[ -f "${map_file}" ]] || { add_error "Missing skill dependency map: ${map_file}"; return 0; }

  local known_skills
  known_skills="$(find "${skills_dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)"

  local row_no=0
  local has_row=0
  while IFS=$'\t' read -r from to relation required order_weight reason; do
    row_no=$((row_no + 1))
    [[ -n "${from}${to}${relation}${required}${order_weight}${reason}" ]] || continue
    [[ "${from}" =~ ^# ]] && continue
    has_row=1
    if ! printf '%s\n' "${known_skills}" | grep -qx "${from}"; then
      add_error "${map_file}:${row_no}: unknown skill '${from}'"
    fi
    if ! printf '%s\n' "${known_skills}" | grep -qx "${to}"; then
      add_error "${map_file}:${row_no}: unknown skill '${to}'"
    fi
    [[ "${from}" != "${to}" ]] || add_error "${map_file}:${row_no}: self-loop not allowed"
    [[ "${relation}" == "precedes" ]] || add_error "${map_file}:${row_no}: relation must be 'precedes'"
    [[ "${required}" == "true" || "${required}" == "false" ]] || add_error "${map_file}:${row_no}: required must be true or false"
    [[ "${order_weight}" =~ ^[0-9]+$ ]] || add_error "${map_file}:${row_no}: order_weight must be an integer"
  done < "${map_file}"

  if [[ "${has_row}" -eq 0 ]]; then
    add_error "${map_file}: must contain at least one dependency row"
  fi
}

check_markdown_links() {
  local file="$1"
  local file_dir
  file_dir="$(dirname "${file}")"
  local target
  while IFS= read -r target; do
    [[ -n "${target}" ]] || continue
    [[ "${target}" == http://* || "${target}" == https://* || "${target}" == "#"* || "${target}" == mailto:* ]] && continue
    target="${target%%#*}"
    [[ -n "${target}" ]] || continue
    local resolved
    if [[ "${target}" == /* ]]; then
      resolved="${target}"
    else
      resolved="${file_dir}/${target}"
    fi
    if [[ ! -e "${resolved}" && ! -e "${REPO_ROOT}/${target}" ]]; then
      add_error "${file}: broken link -> ${target}"
    fi
  done < <(
    grep -oE '\[[^]]*\]\([^)]+\)' "${file}" 2>/dev/null | sed 's/.*](//' | sed 's/)$//' || true
  )
}

read_manifest_value() {
  local key="$1"
  awk -F= -v key="${key}" '$1 == key { print $2 }' "sdd/system/manifest.env" 2>/dev/null | tail -1
}

required_paths=(
  "sdd/system/README.md"
  "sdd/system/manifest.env"
  "sdd/system/rules/index.md"
  "sdd/system/runtime/minimal.md"
  "sdd/system/runtime/context-packs.tsv"
  "sdd/system/adapters/README.md"
  "sdd/system/adapters/common-instructions.md"
  "sdd/system/adapters/ignore-patterns.txt"
  "sdd/memory-bank/INDEX.md"
  "sdd/memory-bank/core/implementation-brief.md"
  "sdd/memory-bank/core/activeContext-archive.md"
  "sdd/memory-bank/core/progress-archive.md"
  "sdd/memory-bank/discovery/README.md"
)

for p in "${required_paths[@]}"; do
  [[ -e "${p}" ]] || add_error "Missing required path: ${p}"
done

legacy_forbidden=(
  "sdd/.agent"
  "AGENT.md"
  ".cursorrules"
)
for p in "${legacy_forbidden[@]}"; do
  [[ ! -e "${p}" ]] || add_error "Legacy path must not exist in v2: ${p}"
done

repo_mode="$(read_manifest_value "repo_mode")"
spectra_version="$(read_manifest_value "spectra_version")"
[[ -n "${spectra_version}" ]] || add_error "sdd/system/manifest.env: missing spectra_version"
if [[ "${repo_mode}" != "canonical" && "${repo_mode}" != "consumer" ]]; then
  add_error "sdd/system/manifest.env: repo_mode must be canonical or consumer"
fi

if [[ "${repo_mode}" == "canonical" ]]; then
  required_paths+=(
    "scripts/_runtime.sh"
    "scripts/generate-adapters.sh"
    "scripts/context-pack.sh"
    "scripts/discuss-task.sh"
    "scripts/map-codebase.sh"
    "scripts/verify-work.sh"
    "scripts/quick.sh"
  )
fi

if [[ -f "sdd/system/rules/index.md" ]]; then
  check_index_backtick_paths "sdd/system/rules/index.md" "sdd/system"
fi
if [[ -f "sdd/system/prompts/index.md" ]]; then
  check_index_backtick_paths "sdd/system/prompts/index.md" "sdd/system/prompts"
fi
if [[ -f "sdd/memory-bank/INDEX.md" ]]; then
  check_index_backtick_paths "sdd/memory-bank/INDEX.md" "sdd/memory-bank"
fi

required_packs=(
  bootstrap
  intake-core
  intake-backend
  intake-web
  intake-mobile
  intake-cli
  intake-worker
  intake-library
  brownfield-discovery
  implementation-discuss
  bugfix
  post-approval-api-change
  post-approval-db-change
  release
  verify-work
  quick
)

if [[ -f "sdd/system/runtime/context-packs.tsv" ]]; then
  for pack in "${required_packs[@]}"; do
    if ! awk -F'\t' -v pack="${pack}" '$1 == pack { found = 1 } END { exit(found ? 0 : 1) }' "sdd/system/runtime/context-packs.tsv"; then
      add_error "sdd/system/runtime/context-packs.tsv: missing pack '${pack}'"
    fi
  done
fi

tmp_dir="$(mktemp -d 2>/dev/null)" \
  || tmp_dir="$(TMPDIR=/tmp mktemp -d 2>/dev/null)" \
  || { tmp_dir="${REPO_ROOT}/.validate-tmp"; mkdir -p "${tmp_dir}"; }
cleanup() { rm -rf "${tmp_dir}"; }
trap cleanup EXIT

skills_dir="sdd/system/skills"
skills_index="${skills_dir}/index.md"
indexed_skills=""
if [[ -f "${skills_index}" ]]; then
  indexed_skills="$(extract_backtick_tokens "${skills_index}" | awk 'index($0, "/") == 0 && index($0, ".") == 0 { print }' | sort -u)"
fi
if [[ -d "${skills_dir}" ]]; then
  for d in "${skills_dir}"/*; do
    [[ -d "${d}" ]] || continue
    skill_name="$(basename "${d}")"
    skill_md="${d}/SKILL.md"
    [[ -f "${skill_md}" ]] || { add_error "${d}: missing SKILL.md"; continue; }

    name_out="${tmp_dir}/skill.name"
    desc_out="${tmp_dir}/skill.desc"
    parse_skill_front_matter "${skill_md}" "${name_out}" "${desc_out}"
    parsed_name="$(cat "${name_out}" 2>/dev/null || true)"
    if [[ -n "${parsed_name}" && "${parsed_name}" != "${skill_name}" ]]; then
      add_error "${skill_md}: front matter name '${parsed_name}' does not match directory '${skill_name}'"
    fi

    task_types="$(extract_front_matter_field "${skill_md}" "task_types")"
    [[ -n "${task_types}" ]] || add_error "${skill_md}: front matter missing \`task_types\`"

    if [[ -n "${indexed_skills}" ]] && ! printf '%s\n' "${indexed_skills}" | grep -qx "${skill_name}"; then
      add_error "${d}: not listed in sdd/system/skills/index.md"
    fi
  done
fi

check_skill_dependency_map "${skills_dir}/dependency-map.tsv" "${skills_dir}"

prompts_root="sdd/system/prompts"
prompts_index="${prompts_root}/index.md"
if [[ -f "${prompts_index}" ]]; then
  indexed_prompts="$(
    extract_backtick_tokens "${prompts_index}" \
      | awk 'index($0, "/") > 0 && $0 ~ /\.md$/ { print }' \
      | sort -u
  )"
  while IFS= read -r -d '' p; do
    rel="${p#${prompts_root}/}"
    if ! printf '%s\n' "${indexed_prompts}" | grep -qx "${rel}"; then
      add_error "${prompts_root}/${rel}: not listed in prompts index"
    fi
  done < <(
    find "${prompts_root}" -type f -name '*.md' \
      ! -name 'README.md' ! -name 'USAGE.md' ! -name 'index.md' -print0
  )
fi

while IFS= read -r -d '' f; do
  check_markdown_has_h1 "${f}"
  check_examples_inside_html_comments "${f}"
done < <(find "sdd/memory-bank" -type f -name '*.md' -print0)

while IFS= read -r -d '' f; do
  check_markdown_has_h1 "${f}"
done < <(find "sdd/system" -type f -name '*.md' -print0)

while IFS= read -r -d '' f; do
  check_markdown_links "${f}"
done < <(find "docs" -type f -name '*.md' -print0 2>/dev/null)

while IFS= read -r -d '' f; do
  check_markdown_links "${f}"
done < <(find "sdd/memory-bank" -type f -name '*.md' -print0 2>/dev/null)

while IFS= read -r -d '' f; do
  check_markdown_links "${f}"
done < <(find "sdd/system" -type f -name '*.md' -print0 2>/dev/null)

generated_a="${tmp_dir}/generated-a"
generated_b="${tmp_dir}/generated-b"
mkdir -p "${generated_a}" "${generated_b}"

if ! run_runtime_script generate-adapters.sh --agents claude,cursor,windsurf,copilot,codex,antigravity --target "${generated_a}" >/dev/null 2>&1; then
  add_error "scripts/generate-adapters.sh: failed smoke generation into temp dir"
fi
if ! run_runtime_script generate-adapters.sh --agents claude,cursor,windsurf,copilot,codex,antigravity --target "${generated_b}" >/dev/null 2>&1; then
  add_error "scripts/generate-adapters.sh: failed second smoke generation into temp dir"
fi
if [[ -d "${generated_a}" && -d "${generated_b}" ]] && ! diff -qr "${generated_a}" "${generated_b}" >/dev/null 2>&1; then
  add_error "scripts/generate-adapters.sh: generation is not deterministic"
fi

adapter_outputs=(
  "AGENTS.md"
  "CLAUDE.md"
  ".github/copilot-instructions.md"
  ".cursor/rules/spectra-core.mdc"
  ".cursor/rules/spectra-workflow.mdc"
  ".cursor/rules/spectra-context.mdc"
  ".windsurf/rules/spectra-core.md"
  ".windsurf/rules/spectra-workflow.md"
  ".windsurf/rules/spectra-context.md"
  ".agent/rules/spectra-core.md"
  ".agent/rules/spectra-workflow.md"
  ".agent/rules/spectra-context.md"
)

if [[ "${repo_mode}" == "canonical" ]]; then
  for p in "${adapter_outputs[@]}"; do
    [[ ! -e "${p}" ]] || add_error "Canonical repo must not commit generated adapter output: ${p}"
  done
elif [[ "${repo_mode}" == "consumer" ]]; then
  for p in "${adapter_outputs[@]}"; do
    [[ -e "${p}" ]] || continue
    if [[ ! -e "${generated_a}/${p}" ]]; then
      add_error "Adapter output exists but generator did not produce it: ${p}"
      continue
    fi
    if ! diff -q "${p}" "${generated_a}/${p}" >/dev/null 2>&1; then
      add_error "Adapter output does not match generated template: ${p}"
    fi
  done
fi

if [[ "${STRICT}" -eq 1 && "${repo_mode}" == "canonical" ]]; then
  for p in scripts/*.sh; do
    [[ -f "${p}" ]] || continue
    [[ -x "${p}" ]] || add_error "${p}: script should be executable"
  done
fi

if [[ "${#warns[@]}" -gt 0 ]]; then
  echo "Validation warnings:"
  for w in "${warns[@]}"; do
    echo "- ${w}"
  done
  echo ""
fi

if [[ "${#errors[@]}" -gt 0 ]]; then
  echo "Validation errors:"
  for e in "${errors[@]}"; do
    echo "- ${e}"
  done
  echo ""
  echo "Validation: FAIL"
  exit 1
fi

echo "Validation: OK"
