import test from "node:test";
import assert from "node:assert/strict";
import { checkAgentHealth, checkAgentsHealth, normalizeAgents } from "./agent-health.js";

test("normalizeAgents handles csv and arrays", () => {
  assert.deepEqual(normalizeAgents("codex, cursor ,claude"), ["codex", "cursor", "claude"]);
  assert.deepEqual(normalizeAgents(["codex", " cursor ", ""]), ["codex", "cursor"]);
});

test("codex is unhealthy when AGENTS.md is missing", () => {
  const result = checkAgentHealth("/tmp/project", "codex", {
    commandExists: () => true,
    fileExists: () => false
  });

  assert.equal(result.detected, false);
  assert.equal(result.healthy, false);
});

test("codex is unhealthy when CLI is missing", () => {
  const result = checkAgentHealth("/tmp/project", "codex", {
    commandExists: () => false,
    fileExists: () => true,
    readFile: () => "# Spectra Adapter (Codex)\n"
  });

  assert.equal(result.detected, true);
  assert.equal(result.healthy, false);
});

test("claude is healthy when CLAUDE.md matches the expected template", () => {
  const result = checkAgentHealth("/tmp/project", "claude", {
    fileExists: () => true,
    readFile: () => "# Spectra Core Instructions\n"
  });

  assert.equal(result.detected, true);
  assert.equal(result.healthy, true);
});

test("cursor is unhealthy when any required file is missing", () => {
  const result = checkAgentHealth("/tmp/project", "cursor", {
    fileExists: (file) => !file.endsWith("spectra-context.mdc"),
    readFile: () => "# Spectra Core\n"
  });

  assert.equal(result.detected, true);
  assert.equal(result.healthy, false);
});

test("checkAgentsHealth returns one result per requested agent", () => {
  const results = checkAgentsHealth("/tmp/project", "claude,codex", {
    commandExists: () => true,
    fileExists: () => true,
    readFile: (file) =>
      file.endsWith("CLAUDE.md") ? "# Spectra Core Instructions\n" : "# Spectra Adapter (Codex)\n"
  });

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => result.agent),
    ["claude", "codex"]
  );
});
