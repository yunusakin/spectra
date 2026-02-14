#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/validate-repo.sh [--strict]

Checks:
- Required paths exist
- Index files reference existing markdown files
- Adapter bodies match (AGENT.md, AGENTS.md, CLAUDE.md, .cursorrules)
- Skills: SKILL.md exists + YAML front matter (name/description) + index coverage
- Prompts: all prompt files are listed in prompts index
- Markdown expectations for templates

Exit codes:
  0: OK
  1: FAIL
  2: CLI usage error
EOF
}

STRICT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

errors=()
warns=()

add_error() { errors+=("$1"); }
add_warn() { warns+=("$1"); }

extract_backtick_tokens() {
  local file="$1"
  # grep exits 1 on "no matches"; that is not an error for our use.
  grep -oE '`[^`]+`' "$file" 2>/dev/null | sed 's/^`//;s/`$//' || true
}

check_markdown_has_h1() {
  local file="$1"
  local first
  first="$(awk 'NF {print; exit}' "$file" 2>/dev/null || true)"
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
    ' "$file"
  )
}

check_index_backtick_paths() {
  local index_path="$1"
  local base_dir="$2"
  local tok
  while IFS= read -r tok; do
    [[ -n "${tok}" ]] || continue
    if [[ "${tok}" == */* && "${tok}" == *.md ]]; then
      if [[ -e "${base_dir}/${tok}" ]]; then
        continue
      fi
      if [[ -e "${REPO_ROOT}/${tok}" ]]; then
        continue
      fi
      add_error "${index_path}: references missing file \`${tok}\`"
    fi
  done < <(extract_backtick_tokens "${index_path}")
}

normalize_adapter_body() {
  local file="$1"
  # Drop the first line and trim leading/trailing blank lines.
  tail -n +2 "$file" | sed 's/[[:space:]]*$//' | awk '
    { lines[++n] = $0 }
    END {
      start = 1
      while (start <= n && lines[start] ~ /^[[:space:]]*$/) start++
      end = n
      while (end >= start && lines[end] ~ /^[[:space:]]*$/) end--
      for (i = start; i <= end; i++) print lines[i]
    }
  '
}

parse_skill_front_matter() {
  local skill_md="$1"
  local out_name="$2"
  local out_desc="$3"

  # Defaults (written by echo at end)
  local name=""
  local desc=""
  local end_found=0

  local first
  first="$(head -n 1 "$skill_md" 2>/dev/null | tr -d '\r' || true)"
  if [[ "${first}" != "---" ]]; then
    add_error "${skill_md}: missing YAML front matter (expected leading '---')"
    printf '%s\n' "" "" > "${out_name}"
    printf '%s\n' "" "" > "${out_desc}"
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
  done < "$skill_md"

  if [[ "${end_found}" -eq 0 ]]; then
    add_error "${skill_md}: YAML front matter not closed (missing second '---')"
  fi
  if [[ -z "${name}" ]]; then
    add_error "${skill_md}: front matter missing \`name\`"
  fi
  if [[ -z "${desc}" ]]; then
    add_error "${skill_md}: front matter missing \`description\`"
  fi

  printf '%s\n' "${name}" > "${out_name}"
  printf '%s\n' "${desc}" > "${out_desc}"
}

########
# Checks
########

required_paths=(
  "sdd/.agent/rules/index.md"
  "sdd/memory-bank/INDEX.md"
  "AGENT.md"
  "AGENTS.md"
  "CLAUDE.md"
  ".cursorrules"
)
for p in "${required_paths[@]}"; do
  if [[ ! -e "${p}" ]]; then
    add_error "Missing required path: ${p}"
  fi
done

# Validate index references
if [[ -f "sdd/.agent/rules/index.md" ]]; then
  check_index_backtick_paths "sdd/.agent/rules/index.md" "sdd/.agent"
fi
if [[ -f "sdd/.agent/prompts/index.md" ]]; then
  check_index_backtick_paths "sdd/.agent/prompts/index.md" "sdd/.agent/prompts"
fi
if [[ -f "sdd/memory-bank/INDEX.md" ]]; then
  check_index_backtick_paths "sdd/memory-bank/INDEX.md" "sdd/memory-bank"
fi

# Adapter consistency: bodies should match (ignore first line)
tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "${tmp_dir}"; }
trap cleanup EXIT

adapter_paths=("AGENT.md" "AGENTS.md" "CLAUDE.md" ".cursorrules")
ref_path=""
for p in "${adapter_paths[@]}"; do
  if [[ -f "${p}" ]]; then
    ref_path="${p}"
    break
  fi
done

if [[ -n "${ref_path}" ]]; then
  normalize_adapter_body "${ref_path}" > "${tmp_dir}/adapter.ref"
  for p in "${adapter_paths[@]}"; do
    [[ -f "${p}" ]] || continue
    normalize_adapter_body "${p}" > "${tmp_dir}/adapter.cur"
    if ! diff -q "${tmp_dir}/adapter.ref" "${tmp_dir}/adapter.cur" >/dev/null 2>&1; then
      add_error "Adapter bodies differ (expected identical content after first line): ${ref_path}, ${p}"
    fi
  done
fi

# Skills: SKILL.md + front matter + index coverage
skills_dir="sdd/.agent/skills"
skills_index="${skills_dir}/index.md"
indexed_skills=""
if [[ -f "${skills_index}" ]]; then
  indexed_skills="$(
    extract_backtick_tokens "${skills_index}" \
      | awk 'index($0, "/") == 0 && index($0, ".") == 0 { print }' \
      | sort -u
  )"
fi

if [[ -d "${skills_dir}" ]]; then
  for d in "${skills_dir}"/*; do
    [[ -d "${d}" ]] || continue
    skill_name="$(basename "${d}")"
    skill_md="${d}/SKILL.md"
    if [[ ! -f "${skill_md}" ]]; then
      add_error "${d}: missing SKILL.md"
      continue
    fi

    name_out="${tmp_dir}/skill.name"
    desc_out="${tmp_dir}/skill.desc"
    parse_skill_front_matter "${skill_md}" "${name_out}" "${desc_out}"
    parsed_name="$(cat "${name_out}" 2>/dev/null || true)"
    if [[ -n "${parsed_name}" && "${parsed_name}" != "${skill_name}" ]]; then
      add_error "${skill_md}: front matter name '${parsed_name}' does not match directory '${skill_name}'"
    fi

    if [[ -n "${indexed_skills}" ]]; then
      if ! printf '%s\n' "${indexed_skills}" | grep -qx "${skill_name}"; then
        add_error "${d}: not listed in sdd/.agent/skills/index.md"
      fi
    fi
  done
fi

# Prompt index coverage
prompts_root="sdd/.agent/prompts"
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

# Markdown checks (templates)
while IFS= read -r -d '' f; do
  check_markdown_has_h1 "${f}"
  check_examples_inside_html_comments "${f}"
done < <(find "sdd/memory-bank" -type f -name '*.md' -print0)

while IFS= read -r -d '' f; do
  check_markdown_has_h1 "${f}"
done < <(find "sdd/.agent/rules" -type f -name '*.md' -print0)

# Markdown link checker — resolve [text](relative/path) links
check_markdown_links() {
  local file="$1"
  local file_dir
  file_dir="$(dirname "${file}")"
  local target
  # Extract markdown link targets: [text](target) — skip URLs, anchors, images, and mermaid
  while IFS= read -r target; do
    [[ -n "${target}" ]] || continue
    # Skip URLs, pure anchors, and mailto
    [[ "${target}" == http://* || "${target}" == https://* || "${target}" == "#"* || "${target}" == mailto:* ]] && continue
    # Strip trailing anchor fragment
    target="${target%%#*}"
    [[ -n "${target}" ]] || continue
    # Resolve relative to file's directory
    local resolved
    if [[ "${target}" == /* ]]; then
      resolved="${target}"
    else
      resolved="${file_dir}/${target}"
    fi
    if [[ ! -e "${resolved}" ]]; then
      # Also try relative to repo root
      if [[ ! -e "${REPO_ROOT}/${target}" ]]; then
        add_error "${file}: broken link -> ${target}"
      fi
    fi
  done < <(
    grep -oE '\[[^]]*\]\([^)]+\)' "${file}" 2>/dev/null \
      | sed 's/.*](//' | sed 's/)$//' || true
  )
}

while IFS= read -r -d '' f; do
  check_markdown_links "${f}"
done < <(find "docs" -type f -name '*.md' -print0 2>/dev/null)

while IFS= read -r -d '' f; do
  check_markdown_links "${f}"
done < <(find "sdd/memory-bank" -type f -name '*.md' -print0 2>/dev/null)

while IFS= read -r -d '' f; do
  check_markdown_links "${f}"
done < <(find "sdd/.agent" -type f -name '*.md' -print0 2>/dev/null)

########
# Report
########

if [[ "${#errors[@]}" -gt 0 ]]; then
  echo "Errors:"
  for m in "${errors[@]}"; do
    echo "- ${m}"
  done
  echo
fi

if [[ "${#warns[@]}" -gt 0 ]]; then
  echo "Warnings:"
  for m in "${warns[@]}"; do
    echo "- ${m}"
  done
  echo
fi

if [[ "${#errors[@]}" -gt 0 || ( "${STRICT}" -eq 1 && "${#warns[@]}" -gt 0 ) ]]; then
  echo "Validation: FAIL"
  exit 1
fi

echo "Validation: OK"
exit 0

