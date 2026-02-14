#!/usr/bin/env bash
set -euo pipefail

# Normalize Excalidraw-exported SVG snapshots for GitHub rendering.
# Excalidraw may place text near y=0; when GitHub falls back fonts, ascenders can clip.
# This script adds vertical viewBox/background padding to avoid clipped labels.
#
# Usage:
#   scripts/normalize-diagram-svgs.sh
#   scripts/normalize-diagram-svgs.sh docs/diagrams/*.svg
#   scripts/normalize-diagram-svgs.sh docs/diagrams

PAD=24

if [ "$#" -eq 0 ]; then
  set -- docs/diagrams/*.svg
fi

shopt -s nullglob
files=()

for input in "$@"; do
  if [ -d "$input" ]; then
    while IFS= read -r -d '' file; do
      files+=("$file")
    done < <(find "$input" -type f -name "*.svg" -print0)
    continue
  fi

  if [ -f "$input" ]; then
    files+=("$input")
    continue
  fi

  while IFS= read -r file; do
    files+=("$file")
  done < <(compgen -G "$input" || true)
done

if [ "${#files[@]}" -eq 0 ]; then
  echo "No SVG files found."
  exit 0
fi

for file in "${files[@]}"; do
  PAD="$PAD" perl -0777 -i -pe '
    my $pad = $ENV{PAD} // 24;
    s{viewBox="0 0 (\d+) (\d+)" width="\1" height="\2"}{sprintf("viewBox=\"0 -%d %d %d\" width=\"%d\" height=\"%d\"", $pad, $1, $2 + ($pad * 2), $1, $2)}e;
    s{<rect x="0" y="0" width="100%" height="100%" fill="#ffffff"></rect>}{sprintf("<rect x=\"0\" y=\"-%d\" width=\"100%%\" height=\"100%%\" fill=\"#ffffff\"></rect>", $pad)}e;
    s{<rect x="0" y="0" width="(\d+)" height="(\d+)" fill="#ffffff"></rect>}{sprintf("<rect x=\"0\" y=\"-%d\" width=\"%d\" height=\"%d\" fill=\"#ffffff\"></rect>", $pad, $1, $2 + ($pad * 2))}e;
  ' "$file"

  echo "Normalized $file"
done
