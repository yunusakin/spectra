# Security Basics

## Mandatory Checks (Agent MUST verify for any code that handles user data or external input)
- [ ] All external inputs are validated and sanitized (query params, headers, body, path params)
- [ ] AuthN is enforced for all protected endpoints (no endpoint accessible without authentication unless explicitly public)
- [ ] AuthZ follows least privilege — users can only access their own resources unless they have an elevated role
- [ ] Secrets and credentials are never hard-coded in source — use environment variables or a secrets manager
- [ ] Secrets are never logged, even at DEBUG level
- [ ] PII (names, emails, addresses, phone numbers) is not logged in plaintext
- [ ] Transport security: TLS required for all external communication, secure cookie flags set
- [ ] Dependencies are checked for known CVEs before adding (and periodically)
- [ ] Safe defaults: security features are ON by default, not opt-in

## When to Report Errors
If any check above fails, the agent MUST:
1. Stop code generation and flag the security violation.
2. Propose a fix that satisfies the rule.
3. Wait for confirmation before proceeding.

## Reference
- Skill: `sdd/.agent/skills/security-review-lite/SKILL.md`
