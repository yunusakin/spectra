# Skills Dependency Graph (Suggested)

Arrows mean "often used together" or "often comes next".

- Visual reference: this file
- Canonical machine-readable source: `sdd/.agent/skills/dependency-map.tsv`

```mermaid
graph TD
  api[api-design] --> sec[security-review-lite]
  api --> test[testing-plan]
  sec --> test

  db[db-migration] --> api
  db --> test
  db --> ops[ops-deploy]

  test --> ops

  api --> rel[release-prep]
  db --> rel
  ops --> rel
  test --> rel
  sec --> rel
```
