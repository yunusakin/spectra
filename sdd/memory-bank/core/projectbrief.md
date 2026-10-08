# Project Brief

> Maintained project context for Spectra itself.

## Project Name
Spectra

## Purpose
Provide persistent, governed project intelligence for interchangeable coding agents: a native, CLI-first, project-local layer that keeps product intent, rules, requirements, traceability and verification evidence resolvable on demand. Spec-driven development with staged approvals is one capability of that layer.

## App Type
Developer CLI and reusable project runtime

## Product Context
Spectra is distributed through npm and standalone macOS/Linux binaries. Every project receives the complete Spectra workflow by default, with generated state under `.spectra/`; projects can keep that state private through Git local-exclude mode or commit it through shared mode.

<!--
Example:
### Target Users
- Internal customer support agents.
- External B2B partners creating bulk orders.

### Main Use Cases
- Look up a customer's recent orders while on a support call.
- Let partners submit orders via API instead of email.

### Value Proposition
- Reduce manual order entry and errors.
- Give support team a single place to view customer activity.
-->

## Requirements

### Functional Requirements
- Initialize and adopt repositories with the complete Spectra workflow by default.
- Keep all Spectra-owned generated content under `.spectra/`.
- Provide concise context, route, inspect, task, check, verify, status, and help commands, so an agent or person can resolve what governs a subject and whether the evidence supports it.
- Keep the machine lifecycle (install, update, uninstall) separate from the project lifecycle (init, adopt, migrate).
- Support safe legacy-layout migration and native installation without Node or npm.

### Non-Functional Requirements
- Preserve company files and Git policies during local-mode installation and migration.
- Keep npm, native, and runtime versions synchronized.
- Verify behavior through automated CLI and native smoke tests.

<!--
Example:
### Functional Requirements
- Users can create and update orders.
- System calculates total price including tax and discounts.
- Admins can view order history per customer.

### Non-Functional Requirements
- p95 latency < 300ms for GET /orders.
- Availability target: 99.9%.
-->

## Constraints

### Technical Constraints
- Node.js ESM powers the npm CLI; native macOS/Linux builds use Node SEA.
- Generated runtime must work from the repository-local launcher.
- Spectra supplies project knowledge and does not run coding agents; retrieval is deterministic, lexical and budget-aware, with no semantic or vector search.

### Security & Compliance
- Local mode must not modify `.gitignore` and must use Git's repository-local exclude file.
- Only an explicit `spectra migrate` changes a project's layout or schema; `spectra update` changes the machine application only and never reads or writes a project.

### Organizational
- Spectra documentation must not be committed to company projects by default.

<!--
Example:
### Technical Constraints
- Must run on Kubernetes in the existing company cluster.
- Use PostgreSQL only (no additional databases).

### Security & Compliance
- Must not store raw credit card data.
- Must comply with GDPR for EU customers.

### Organizational
- Team is experienced with Java and React; avoid exotic stacks.
-->
