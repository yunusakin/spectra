# Deployment Standards

## Mandatory Checks (Agent MUST verify before generating deployment config)
- [ ] Environments are defined explicitly (dev, staging, production) with clear promotion path
- [ ] All configurable values use environment variables or config files — no environment-specific values hard-coded
- [ ] Health check endpoints are defined (liveness + readiness for container workloads)
- [ ] Deployment steps are documented (what to run, in what order, with expected output)
- [ ] Rollback plan is documented — how to revert if the deployment fails
- [ ] Monitoring and alerting: at minimum, error rate + latency dashboards for production

## Optional but Recommended
- Blue/green or canary rollout strategy for production
- Smoke test suite that runs post-deployment
- Database migration run order relative to app deployment

## When to Report Errors
If any mandatory check above fails, the agent MUST:
1. Flag the missing deployment artifact.
2. Propose a fix or template.
3. Wait for confirmation before proceeding.

## Reference
- Skill: `sdd/.agent/skills/ops-deploy/SKILL.md`
