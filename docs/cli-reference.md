# CLI Reference

This is the current public command surface.

Install options:

```bash
npx spectra-pack@latest init my-product
curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/main/install.sh | sh
```

## Setup

```bash
spectra init [path]
spectra adopt [path]
```

## Workflow

```bash
spectra context --role <role> --goal <goal>
spectra task --item <id> --task-type <type> --goal "<goal>"
spectra approve --stage <product-approved|technical-approved|implementation-approved|release-approved>
spectra validate [--base <sha> --head <sha>]
spectra verify [--scope <all|spec|app>] [--profile <standard|release>]
spectra status
spectra doctor
spectra quick --type <docs|rules|spec|ops> --task "<task>"
spectra skills --task-type <type> [--skills <csv>]
spectra eval <feature-id> --suite <smoke|release>
```

## Utilities

```bash
spectra adapters --agents <csv> --target <path>
spectra diff <init|update|semantic>
```

## Recommended Role and Goal Pairs

- `planner + discover`
- `planner + decide`
- `implementer + implement`
- `verifier + verify`
- `release-manager + ship`

## Recommended Daily Flow

```bash
spectra context --role planner --goal discover
spectra validate
spectra approve --stage implementation-approved
spectra task --item FEAT-001 --task-type feature --goal "Implement core product flow"
spectra eval <feature-id> --suite smoke
spectra verify --profile release
```
