# Integration Plan Template

## Goal
<!-- What systems are you connecting and why? -->

## Systems Involved
<!-- List every system, service, or third-party API involved with its role. -->
| System | Role | Owner |
|--------|------|-------|
|        |      |       |

## API Contracts
<!-- Request/response schemas, authentication, rate limits, versioning. Reference existing API docs if available. -->

## Data Flow
<!-- Describe the data path from source to destination, including transformations. A Mermaid sequence diagram is recommended. -->

## Error Handling
<!-- How each failure mode is detected, reported, and recovered from. Include retry/backoff strategy. -->
| Failure Mode | Detection | Recovery |
|-------------|-----------|----------|
|             |           |          |

## Security Considerations
<!-- Auth, encryption in transit/at rest, PII handling, secrets management. -->

## Dependencies
<!-- What must exist before this integration can work? -->

## Testing Plan
<!-- Contract tests, integration tests, mock strategy, staging validation. -->

## Rollback Plan
<!-- How to safely disconnect or revert the integration. -->

## Verification
<!-- How you will confirm the integration works end-to-end. -->
