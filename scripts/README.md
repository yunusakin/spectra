# Scripts

This directory contains helper scripts for development and maintenance.

## Conventions
- Prefer small, single-purpose scripts.
- Document inputs, outputs, and side effects at the top of each script.
- Do not write to `app/` unless explicitly intended.

## Scripts
- `validate-repo.sh`: Validate rule/spec index references, adapter consistency, and template formatting.
- `spec-diff.sh`: Append a markdown diff entry for spec changes under `sdd/memory-bank/`.
- `normalize-diagram-svgs.sh`: Add safe vertical padding to Excalidraw SVG exports to prevent clipped text on GitHub.
