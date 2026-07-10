# Project Brief

> Maintained project context for Spectra itself.

## Project Name
Spectra

## Purpose
Provide a native, CLI-first spec-driven development framework that keeps product intent, working context, validation, and release governance in a portable project-local layer.

## App Type
Developer CLI and reusable project runtime

## Product Context
Spectra is distributed through npm and standalone macOS/Linux binaries. It supports Lite and Full profiles, keeps generated state under `spectra/`, and can be used privately through Git local-exclude mode or committed through shared mode.

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
- Initialize and adopt repositories with Lite or Full profiles.
- Keep all Spectra-owned generated content under `spectra/`.
- Provide concise context, task, check, status, help, and update workflows.
- Support safe legacy-layout migration and native installation without Node or npm.

### Non-Functional Requirements
- Preserve company files and Git policies during local-mode installation and migration.
- Keep npm, native, runtime, and profile versions synchronized.
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

### Security & Compliance
- Local mode must not modify `.gitignore` and must use Git's repository-local exclude file.
- Updates and migrations must require confirmation before mutating a project.

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
