# Example: CLI (Reporting Tool)

Use this scenario to shape the core executable spec bundle created by `spectra init` or `spectra adopt`.

## Phase 1 (Core) Answers
- Project name: Billing Reports CLI
- Primary purpose/goal: Generate billing reports from an internal API for finance.
- App type: CLI
- Primary language: Go
- Language version: 1.22
- Framework: None
- Framework version: none
- Architecture style: Layered
- Primary data store: None
- Data store version: none
- Deployment target: Local only
- API style: Other

## Phase 2 (Type-Specific) Answers: CLI
- Primary users: Operators/SRE
- Supported OS: macOS, Linux
- Command list:
  - `reports generate`
  - `reports validate`
  - `auth login`
  - `version`
- Output formats: Both
- Configuration: Combination
- Distribution: Single binary
- Exit code conventions:
  - `0` success
  - `1` validation error
  - `2` network/auth error
  - `>=10` unexpected error
- Does it call external APIs/services?: Yes

## Phase 3 (Advanced, Optional) Answers (Example)
- Testing strategy: Unit+Integration
- CI/CD needs: Basic (lint+test)

## What You Should See Created
- `sdd/features/reporting-core/feature.spec.yaml` for CLI scope, commands, and acceptance
- `sdd/features/reporting-core/technical-decisions.yaml` for distribution, config, and exit code conventions
- `sdd/features/reporting-core/telemetry-contract.yaml` for success, failure, and usage signals
- `sdd/governance/approval-state.yaml` for staged approval progress
