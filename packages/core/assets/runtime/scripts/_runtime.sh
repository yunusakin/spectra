#!/usr/bin/env bash

_spectra_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPECTRA_RUNTIME_ROOT="${SPECTRA_RUNTIME_ROOT:-$(cd "${_spectra_script_dir}/.." && pwd)}"
# Roots: SPECTRA_DATA_ROOT is the directory holding sdd/ (<project>/.spectra for
# canonical installs); SPECTRA_PROJECT_ROOT is the consumer repository root.
# SPECTRA_REPO_ROOT is the legacy alias for the data root.
SPECTRA_REPO_ROOT="${SPECTRA_REPO_ROOT:-${SPECTRA_RUNTIME_ROOT}}"
SPECTRA_DATA_ROOT="${SPECTRA_DATA_ROOT:-${SPECTRA_REPO_ROOT}}"
SPECTRA_PROJECT_ROOT="${SPECTRA_PROJECT_ROOT:-${SPECTRA_DATA_ROOT}}"

run_runtime_script() {
  local script_name="$1"
  shift

  SPECTRA_RUNTIME_ROOT="${SPECTRA_RUNTIME_ROOT}" \
  SPECTRA_REPO_ROOT="${SPECTRA_REPO_ROOT}" \
  SPECTRA_DATA_ROOT="${SPECTRA_DATA_ROOT}" \
  SPECTRA_PROJECT_ROOT="${SPECTRA_PROJECT_ROOT}" \
  bash "${SPECTRA_RUNTIME_ROOT}/scripts/${script_name}" "$@"
}
