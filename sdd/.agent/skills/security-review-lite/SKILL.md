---
name: security-review-lite
description: Quick security review checklist for new features, endpoints, and data handling. Use when adding auth, handling PII, or exposing APIs.
---

# Security Review (Lite)

## Purpose
Identify common security risks early in development.

## Inputs
- Feature summary
- Data classification (PII, credentials, secrets)
- AuthN/AuthZ requirements
- External integrations

## Steps
1. Validate all external inputs and enforce schema rules.
2. Verify authn/authz checks for protected actions.
3. Ensure secrets are not hardcoded or logged.
4. Review logging for PII leakage.
5. Confirm transport security requirements (TLS, secure cookies).
6. Identify dependency risks or known CVEs if applicable.
7. Note required security tests or review steps.

## Outputs
- Security review notes
- Updates to `sdd/memory-bank/core/projectbrief.md` (Constraints section) if needed

## Checklist
- [ ] Input validation enforced
- [ ] AuthN/AuthZ checks present
- [ ] Secrets handled safely
- [ ] PII not logged
- [ ] Transport security considered
- [ ] Security tests identified

## Example Input
- Feature: Export report
- Data: customer email addresses
- Auth: Admin only

## Example Output
- Notes: enforce role checks, redact emails in logs

