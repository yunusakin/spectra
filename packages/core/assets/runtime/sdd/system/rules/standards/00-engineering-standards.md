# Engineering Standards

## Core Principles
- SOLID, DRY, KISS, YAGNI, Separation of Concerns.
- Prefer clear, readable code over cleverness.
- Keep functions and classes small and focused.

## Structure
- Spec-driven artifacts live under `sdd/` only.
- Application code must be generated under `app/` only.

## Naming and Style
- Use consistent naming conventions across layers.
- Avoid abbreviations unless they are standard domain terms.

## Error Handling
- Use structured errors with clear messages.
- Do not expose sensitive details in error responses.

## Logging
- Log important state changes and failures.
- Avoid logging secrets or PII.

## Security
- Follow OWASP basics: validation, output encoding, authz checks.
- Secrets must come from configuration, not source control.

## Testing
- Tests are required for non-trivial logic.
- Prefer unit tests, add integration tests where critical.

## Code Review Checklist
- Requirements covered
- Tests updated/added
- No secrets in code
- Error handling in place
- Docs updated
