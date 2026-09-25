#!/usr/bin/env bash
set -euo pipefail

binary="${1:?Usage: smoke-native.sh <spectra-binary>}"
version="${2:?Usage: smoke-native.sh <spectra-binary> <version>}"

project="$(mktemp -d)"
git -C "$project" init -q
git -C "$project" config user.email spectra@example.test
git -C "$project" config user.name "Spectra Test"
touch "$project/README.md"
git -C "$project" add README.md
git -C "$project" commit -qm initial
"$binary" init "$project"
(cd "$project" && ./.spectra/bin/spectra help)
"$project/.spectra/bin/spectra" status --cwd "$project"
"$project/.spectra/bin/spectra" check --cwd "$project"
"$project/.spectra/bin/spectra" context --role implementer --goal implement --cwd "$project"
"$project/.spectra/bin/spectra" context --role implementer --goal implement --cwd "$project"
cat > "$project/.spectra/sdd/memory-bank/core/projectbrief.md" <<'BRIEF'
# Project Brief

## Project Name
Native Context Refresh Marker
BRIEF
"$project/.spectra/bin/spectra" context --role implementer --goal implement --cwd "$project"
grep -F 'Native Context Refresh Marker' "$project/.spectra/cache/context/project.summary.json"
feature_specs=("$project"/.spectra/sdd/features/*/feature.spec.yaml)
test -f "${feature_specs[0]}"
sleep 1
cat > "${feature_specs[0]}" <<'SPEC'
{"kind":"FeatureSpec","metadata":{"status":"review-ready"},"requirements":{"functional":[],"nonFunctional":[]}}
SPEC
"$project/.spectra/bin/spectra" context --role implementer --goal implement --cwd "$project"
grep -F 'review-ready' "$project/.spectra/cache/context/feature-bundle.summary.json"
grep -F 'review-ready' "$project/.spectra/cache/context/shared-core.summary.json"
SPECTRA_LATEST_VERSION="$version" "$project/.spectra/bin/spectra" update --cwd "$project"
grep -F '"schemaVersion": 3' "$project/.spectra/install.json"
! grep -q '"profile"' "$project/.spectra/install.json"
