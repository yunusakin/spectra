#!/usr/bin/env bash

_spectra_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPECTRA_RUNTIME_ROOT="${SPECTRA_RUNTIME_ROOT:-$(cd "${_spectra_script_dir}/.." && pwd)}"
SPECTRA_REPO_ROOT="${SPECTRA_REPO_ROOT:-${SPECTRA_RUNTIME_ROOT}}"

run_runtime_script() {
  local script_name="$1"
  shift

  SPECTRA_RUNTIME_ROOT="${SPECTRA_RUNTIME_ROOT}" \
  SPECTRA_REPO_ROOT="${SPECTRA_REPO_ROOT}" \
  bash "${SPECTRA_RUNTIME_ROOT}/scripts/${script_name}" "$@"
}
