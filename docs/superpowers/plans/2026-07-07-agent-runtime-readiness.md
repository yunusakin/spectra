# Agent Runtime Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Spectra's agent health model so supported agents can optionally validate stronger runtime prerequisites in addition to adapter-template health.

**Architecture:** Keep the current shared adapter-health registry in one place and add a second layer of runtime probes per agent. The doctor command, setup fail-fast logic, and smoke validation should continue to consume one shared health contract, but that contract should distinguish file/template health from runtime readiness explicitly.

**Tech Stack:** Node.js CLI, shell-based adapter generator, `node:test`, GitHub Actions, repo validation shell scripts

## Global Constraints

- The existing adapter/template health behavior must remain intact for all supported agents.
- Runtime checks must be opt-in per agent definition, not hard-coded in `doctor`.
- Checks must be deterministic in CI and locally testable with stubbed commands or fixtures.
- Do not invent runtime checks for agents unless Spectra can define a stable, local prerequisite signal.
- `spectra doctor`, `install`, and `adapters` must continue to share one health contract.
- TDD applies to every new behavior change.

---

### Task 1: Separate adapter health from runtime health in the shared contract

**Files:**
- Modify: `packages/cli/src/lib/agent-health.js`
- Modify: `packages/cli/src/lib/agent-health.test.js`

**Interfaces:**
- Consumes: `AGENT_DEFINITIONS`, `hasCommand(commandName)`
- Produces: `checkAgentHealth(targetRoot, agent, options?) => { agent, displayName, detected, adapterHealthy, runtimeHealthy, healthy, checks }`

- [ ] **Step 1: Write the failing test**

```js
test("returns adapterHealthy true and runtimeHealthy false when files match but runtime command is missing", () => {
  const result = checkAgentHealth("/tmp/project", "codex", {
    commandExists: () => false,
    fileExists: () => true,
    readFile: () => "# Spectra Adapter (Codex)\n"
  });

  assert.equal(result.detected, true);
  assert.equal(result.adapterHealthy, true);
  assert.equal(result.runtimeHealthy, false);
  assert.equal(result.healthy, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/cli/src/lib/agent-health.test.js`
Expected: FAIL because `adapterHealthy` and `runtimeHealthy` are not returned yet

- [ ] **Step 3: Write minimal implementation**

```js
const adapterHealthy = fileChecks.every((check) => check.status === "ok");
const runtimeChecks = checks.filter((check) => check.kind === "runtime");
const runtimeHealthy = runtimeChecks.every((check) => check.status === "ok");
const healthy = detected && adapterHealthy && runtimeHealthy;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/cli/src/lib/agent-health.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/lib/agent-health.js packages/cli/src/lib/agent-health.test.js
git commit -m "refactor: split adapter and runtime agent health"
```

### Task 2: Add explicit runtime probe metadata to the agent registry

**Files:**
- Modify: `packages/cli/src/lib/agent-health.js`
- Modify: `README.md`
- Modify: `docs/cli-reference.md`

**Interfaces:**
- Consumes: `AGENT_DEFINITIONS`
- Produces: agent definitions with `runtimeProbe` metadata such as `{ type, command, optional }`

- [ ] **Step 1: Write the failing test**

```js
test("codex definition exposes a runtime probe", () => {
  assert.equal(AGENT_DEFINITIONS.codex.runtimeProbe.type, "command");
  assert.equal(typeof AGENT_DEFINITIONS.codex.runtimeProbe.command, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/cli/src/lib/agent-health.test.js`
Expected: FAIL because `runtimeProbe` is not defined

- [ ] **Step 3: Write minimal implementation**

```js
codex: {
  displayName: "Codex",
  files: [...],
  runtimeProbe: {
    type: "command",
    command: () => process.env.SPECTRA_CODEX_COMMAND ?? "codex"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/cli/src/lib/agent-health.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/lib/agent-health.js packages/cli/src/lib/agent-health.test.js README.md docs/cli-reference.md
git commit -m "docs: describe agent runtime probe metadata"
```

### Task 3: Define which non-Codex agents can support real runtime checks

**Files:**
- Modify: `packages/cli/src/lib/agent-health.js`
- Modify: `docs/cli-reference.md`
- Modify: `README.md`
- Create: `docs/examples/agent-runtime-matrix.md`

**Interfaces:**
- Consumes: current supported agent list
- Produces: documented runtime support matrix per agent

- [ ] **Step 1: Write the failing docs test/check**

```bash
rg -n "agent runtime matrix|runtime prerequisite" README.md docs/cli-reference.md docs/examples/agent-runtime-matrix.md
```

Expected: FAIL or missing file/output before the docs are added

- [ ] **Step 2: Run check to verify it fails**

Run: `rg -n "agent runtime matrix|runtime prerequisite" README.md docs/cli-reference.md docs/examples/agent-runtime-matrix.md`
Expected: missing results before implementation

- [ ] **Step 3: Write minimal documentation**

```md
| Agent | Adapter Health | Runtime Probe | Readiness Level |
| --- | --- | --- | --- |
| Codex | yes | `codex` command | strong |
| Claude | yes | none yet | adapter-only |
| Copilot | yes | none yet | adapter-only |
| Cursor | yes | none yet | adapter-only |
| Windsurf | yes | none yet | adapter-only |
| Antigravity | yes | none yet | adapter-only |
```

- [ ] **Step 4: Run check to verify it passes**

Run: `rg -n "agent runtime matrix|runtime prerequisite|adapter-only|strong" README.md docs/cli-reference.md docs/examples/agent-runtime-matrix.md`
Expected: PASS with matching lines

- [ ] **Step 5: Commit**

```bash
git add README.md docs/cli-reference.md docs/examples/agent-runtime-matrix.md
git commit -m "docs: add agent runtime readiness matrix"
```

### Task 4: Add one real non-Codex runtime probe only if Spectra can prove it locally

**Files:**
- Modify: `packages/cli/src/lib/agent-health.js`
- Modify: `packages/cli/src/lib/agent-health.test.js`
- Modify: `packages/cli/src/commands/doctor.js`
- Modify: `packages/cli/src/lib/install.test.js`
- Modify: `packages/cli/src/commands/adapters-generate.test.js`

**Interfaces:**
- Consumes: `runtimeProbe` metadata
- Produces: at least one additional agent with a deterministic runtime probe, or no-op if no stable probe exists

- [ ] **Step 1: Write the failing test**

```js
test("reports runtimeHealthy false for <agent> when its local prerequisite is missing", () => {
  const result = checkAgentHealth("/tmp/project", "<agent>", {
    commandExists: () => false,
    fileExists: () => true,
    readFile: () => "<expected header>\n"
  });

  assert.equal(result.runtimeHealthy, false);
  assert.equal(result.healthy, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/cli/src/lib/agent-health.test.js`
Expected: FAIL until the chosen probe is wired

- [ ] **Step 3: Write minimal implementation**

```js
runtimeProbe: {
  type: "command",
  command: () => "<stable-local-command>"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/cli/src/lib/agent-health.test.js packages/cli/src/lib/install.test.js packages/cli/src/commands/adapters-generate.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/lib/agent-health.js packages/cli/src/lib/agent-health.test.js packages/cli/src/commands/doctor.js packages/cli/src/lib/install.test.js packages/cli/src/commands/adapters-generate.test.js
git commit -m "feat: add <agent> runtime readiness probe"
```

### Task 5: Make doctor output distinguish adapter-only vs runtime-verified agents

**Files:**
- Modify: `packages/cli/src/commands/doctor.js`
- Modify: `packages/cli/src/lib/agent-health.test.js`
- Modify: `README.md`
- Modify: `docs/cli-reference.md`

**Interfaces:**
- Consumes: `checkAgentsHealth(...)`
- Produces: output wording that makes the readiness level explicit

- [ ] **Step 1: Write the failing test**

```js
test("doctor distinguishes adapter-only and runtime-verified agents", () => {
  const output = runDoctorFixture();
  assert.match(output, /Claude: healthy \(adapter-only\)/);
  assert.match(output, /Codex: healthy \(runtime verified\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/cli/src/lib/agent-health.test.js`
Expected: FAIL because doctor still prints only `healthy`

- [ ] **Step 3: Write minimal implementation**

```js
const readinessLabel = agentResult.hasRuntimeProbe ? "runtime verified" : "adapter-only";
ok(`${agentResult.displayName}: healthy (${readinessLabel})`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/cli/src/lib/agent-health.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/doctor.js packages/cli/src/lib/agent-health.test.js README.md docs/cli-reference.md
git commit -m "feat: clarify doctor runtime readiness levels"
```

### Task 6: Extend repo validation and CI around the new readiness levels

**Files:**
- Modify: `scripts/validate-repo.sh`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: `spectra doctor`
- Produces: smoke validation that asserts both adapter-wide health and readiness labels

- [ ] **Step 1: Write the failing smoke expectation**

```bash
grep -q "Codex: healthy (runtime verified)" /tmp/spectra-agent-doctor.log
grep -q "Claude: healthy (adapter-only)" /tmp/spectra-agent-doctor.log
```

- [ ] **Step 2: Run validation to verify it fails**

Run: `bash scripts/validate-repo.sh`
Expected: FAIL before the new output is implemented

- [ ] **Step 3: Write minimal implementation**

```bash
elif ! grep -q "Codex: healthy (runtime verified)" /tmp/spectra-agent-doctor.log \
  || ! grep -q "Claude: healthy (adapter-only)" /tmp/spectra-agent-doctor.log; then
  add_error "spectra doctor: runtime readiness labels are missing or incorrect"
fi
```

- [ ] **Step 4: Run validation to verify it passes**

Run: `bash scripts/validate-repo.sh`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-repo.sh .github/workflows/validate.yml
git commit -m "test: validate agent runtime readiness labels"
```
