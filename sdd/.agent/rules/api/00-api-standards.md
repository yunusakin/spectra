# API Standards

## Mandatory Checks (Agent MUST verify before generating API code)
- [ ] Resource names use plural nouns (`/orders`, not `/order`)
- [ ] HTTP methods match semantics (GET=read, POST=create, PUT=full-replace, PATCH=partial, DELETE=remove)
- [ ] All endpoints define request and response schemas (or reference a shared model)
- [ ] Validation rules are explicit for every input field (type, format, min/max, required/optional)
- [ ] Error responses use a standardized format — prefer [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) or a consistent JSON envelope
- [ ] List endpoints define pagination strategy (cursor or offset), filtering, and sorting
- [ ] Breaking changes increment the API version (path or header)
- [ ] AuthN/AuthZ requirements are documented per endpoint

## When to Report Errors
If any check above fails, the agent MUST:
1. Stop code generation for that endpoint.
2. Report the violation to the user with the specific rule that failed.
3. Wait for confirmation or a fix before proceeding.

## Reference
- Skill: `sdd/.agent/skills/api-design/SKILL.md`
- Prompt: `sdd/.agent/prompts/maintenance/api-endpoint-review-checklist.md`
