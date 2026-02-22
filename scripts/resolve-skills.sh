#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/resolve-skills.sh --task-type <type> [--skills <csv>]

Purpose:
- Resolve skill selection and execution order using skill dependency graph.
- Return non-zero when provided selection/order violates required or ordering rules.

Options:
  --task-type <type>   Task classification (required)
  --skills <csv>       Optional explicit skills/order to validate (comma-separated)
  -h, --help           Show help

Examples:
  bash scripts/resolve-skills.sh --task-type api-change
  bash scripts/resolve-skills.sh --task-type api-db-change --skills db-migration,api-design,testing-plan
USAGE
}

TASK_TYPE=""
SKILLS_CSV=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task-type)
      TASK_TYPE="${2:-}"
      shift 2
      ;;
    --skills)
      SKILLS_CSV="${2:-}"
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

if [[ -z "${TASK_TYPE}" ]]; then
  echo "Error: --task-type is required." >&2
  usage
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

map_file="sdd/.agent/skills/dependency-map.tsv"
skills_dir="sdd/.agent/skills"

if [[ ! -f "${map_file}" ]]; then
  echo "Error: missing ${map_file}" >&2
  exit 1
fi

if [[ ! -d "${skills_dir}" ]]; then
  echo "Error: missing ${skills_dir}" >&2
  exit 1
fi

normalize_csv() {
  local raw="$1"
  echo "${raw}" \
    | tr ',' '\n' \
    | sed 's/^ *//;s/ *$//' \
    | awk 'NF > 0'
}

default_skills_for_task() {
  case "$1" in
    api-change)
      echo "api-design,security-review-lite,testing-plan"
      ;;
    db-change)
      echo "db-migration,testing-plan,ops-deploy"
      ;;
    api-db-change)
      echo "db-migration,api-design,security-review-lite,testing-plan,ops-deploy"
      ;;
    security-change)
      echo "security-review-lite,testing-plan"
      ;;
    deploy-change)
      echo "ops-deploy,testing-plan"
      ;;
    release)
      echo "testing-plan,ops-deploy,release-prep"
      ;;
    full-stack-change)
      echo "db-migration,api-design,security-review-lite,testing-plan,ops-deploy,release-prep"
      ;;
    bugfix)
      echo "testing-plan"
      ;;
    *)
      return 1
      ;;
  esac
}

is_user_input="false"
if [[ -n "${SKILLS_CSV}" ]]; then
  is_user_input="true"
  selected_raw="${SKILLS_CSV}"
else
  if ! selected_raw="$(default_skills_for_task "${TASK_TYPE}")"; then
    echo "Error: unsupported task type '${TASK_TYPE}'." >&2
    echo "Supported: api-change, db-change, api-db-change, security-change, deploy-change, release, full-stack-change, bugfix" >&2
    exit 2
  fi
fi

selected_csv="$(normalize_csv "${selected_raw}" | awk '!seen[$0]++' | paste -sd, -)"
if [[ -z "${selected_csv}" ]]; then
  echo "Error: no skills selected." >&2
  exit 1
fi

known_skills_csv="$(find "${skills_dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | paste -sd, -)"
if [[ -z "${known_skills_csv}" ]]; then
  echo "Error: no skills found under ${skills_dir}." >&2
  exit 1
fi

if awk_output="$(awk \
  -v task_type="${TASK_TYPE}" \
  -v selected_csv="${selected_csv}" \
  -v known_csv="${known_skills_csv}" \
  -v user_input="${is_user_input}" \
  -v map_file="${map_file}" '
  function trim(s) {
    gsub(/^[[:space:]]+/, "", s)
    gsub(/[[:space:]]+$/, "", s)
    return s
  }

  function add_error(msg) {
    errors[++error_count] = msg
  }

  BEGIN {
    n_known = split(known_csv, known_list, ",")
    for (i = 1; i <= n_known; i++) {
      k = trim(known_list[i])
      if (k != "") known[k] = 1
    }

    n_sel = split(selected_csv, input_skills, ",")
    sel_count = 0
    for (i = 1; i <= n_sel; i++) {
      s = trim(input_skills[i])
      if (s == "") continue

      if (!(s in known)) {
        add_error("Unknown skill '\''" s "'\''.")
        continue
      }

      if (!(s in sel_set)) {
        sel_set[s] = 1
        sel[++sel_count] = s
        input_index[s] = sel_count
      }
    }

    if (sel_count == 0) {
      add_error("No valid skills selected.")
    }

    while ((getline line < map_file) > 0) {
      if (line ~ /^[[:space:]]*$/) continue
      if (line ~ /^[[:space:]]*#/) continue

      n = split(line, cols, "\t")
      if (n < 5) continue

      from = trim(cols[1])
      to = trim(cols[2])
      relation = trim(cols[3])
      required = tolower(trim(cols[4]))

      if (relation != "precedes") continue

      edge_count++
      edge_from[edge_count] = from
      edge_to[edge_count] = to
      edge_required[edge_count] = required
    }
    close(map_file)

    for (i = 1; i <= edge_count; i++) {
      from = edge_from[i]
      to = edge_to[i]
      required = edge_required[i]

      if (required == "true" && (to in sel_set) && !(from in sel_set)) {
        add_error("Missing required dependency: '\''" to "'\'' requires '\''" from "'\''.")
      }

      if ((from in sel_set) && (to in sel_set)) {
        if (input_index[from] > input_index[to]) {
          if (required == "true") {
            add_error("Required order violation: '\''" from "'\'' must run before '\''" to "'\''.")
          } else {
            add_error("Order violation: '\''" from "'\'' should run before '\''" to "'\''.")
          }
        }
        indeg[to]++
        outs[from] = outs[from] " " to
      }
    }

    for (i = 1; i <= sel_count; i++) {
      s = sel[i]
      if (!(s in indeg)) indeg[s] = 0
    }

    sorted_count = 0
    while (sorted_count < sel_count) {
      pick = ""
      for (i = 1; i <= sel_count; i++) {
        s = sel[i]
        if (!(s in emitted) && indeg[s] == 0) {
          pick = s
          break
        }
      }

      if (pick == "") {
        add_error("Dependency cycle detected among selected skills.")
        break
      }

      emitted[pick] = 1
      sorted[++sorted_count] = pick

      split(outs[pick], nexts, " ")
      for (j in nexts) {
        t = trim(nexts[j])
        if (t == "") continue
        indeg[t]--
      }
    }

    recommended = ""
    for (i = 1; i <= sorted_count; i++) {
      recommended = recommended (i == 1 ? "" : ",") sorted[i]
    }

    print "Task Type: " task_type
    print "Selected Skills: " selected_csv
    print "Recommended Order: " recommended

    if (error_count > 0) {
      print ""
      print "Skill resolution errors:"
      for (i = 1; i <= error_count; i++) {
        print "- " errors[i]
      }
      if (user_input == "true") {
        print "- Input order from --skills is not graph-compliant."
      }
      exit 1
    }

    print "Skill resolution: OK"
    exit 0
  }
')"; then
  echo "${awk_output}"
  exit 0
else
  echo "${awk_output}"
  exit 1
fi
