---
name: testing-plan
description: Define testing strategy and coverage expectations. Use when planning a feature or release.
task_types: api-change,db-change,api-db-change,security-change,deploy-change,release,full-stack-change,bugfix
---

# Testing Plan

## Purpose
Define test scope, layers, and coverage expectations.

## Inputs
- Feature scope and risk areas
- Target environments
- Non-functional requirements

## Steps
1. Identify unit-test targets and edge cases.
2. Identify integration-test targets and dependencies.
3. Decide on E2E or contract tests if needed.
4. Define coverage target and quality gates.
5. Define test data or fixtures required.
6. Specify CI steps and required test commands.

## Outputs
- Test plan summary
- Updates to `sdd/memory-bank/core/progress.md` if needed

## Checklist
- [ ] Unit tests planned
- [ ] Integration tests planned
- [ ] E2E/contract tests considered
- [ ] Coverage target defined
- [ ] Test data plan documented
- [ ] CI steps defined

## Example Input
- Feature: New order creation flow
- Risk: payment edge cases

## Example Output
- Unit tests for validation
- Integration tests for DB + payment mock

