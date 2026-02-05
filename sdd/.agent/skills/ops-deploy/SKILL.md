---
name: ops-deploy
description: Deployment planning and environment readiness. Use when preparing infra, env vars, or rollout steps.
---

# Ops Deploy

## Purpose
Prepare deployment steps and environment readiness checks.

## Inputs
- Target environments
- Config and secrets requirements
- Rollback expectations
- Monitoring and alerting needs

## Steps
1. Verify environment configuration and secrets.
2. Define deployment steps and health checks.
3. Specify rollout strategy (blue/green, canary, rolling).
4. Document rollback plan and recovery steps.
5. Validate monitoring and alerting coverage.

## Outputs
- Deployment notes
- Updates to `sdd/memory-bank/tech/environments.md`

## Checklist
- [ ] Config/secrets verified
- [ ] Health checks defined
- [ ] Rollout strategy chosen
- [ ] Rollback plan documented
- [ ] Monitoring/alerts confirmed

## Example Input
- Deploy to staging + prod
- New env var: PAYMENT_TIMEOUT

## Example Output
- Env updated, health check verified, rollback documented

