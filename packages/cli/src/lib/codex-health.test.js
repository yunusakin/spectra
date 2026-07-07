import test from "node:test";
import assert from "node:assert/strict";
import { checkCodexHealth } from "./codex-health.js";

test("returns unhealthy when AGENTS.md is missing", () => {
  const result = checkCodexHealth("/tmp/project", {
    hasCodexCommand: true,
    fileExists: () => false
  });

  assert.equal(result.detected, false);
  assert.equal(result.healthy, false);
});

test("returns unhealthy when AGENTS.md exists but codex command is missing", () => {
  const result = checkCodexHealth("/tmp/project", {
    hasCodexCommand: false,
    fileExists: () => true,
    readFile: () => "# Spectra Adapter (Codex)\n"
  });

  assert.equal(result.detected, true);
  assert.equal(result.healthy, false);
});

test("returns unhealthy when AGENTS.md exists but content is not a Spectra adapter", () => {
  const result = checkCodexHealth("/tmp/project", {
    hasCodexCommand: true,
    fileExists: () => true,
    readFile: () => "# Custom Instructions\n"
  });

  assert.equal(result.detected, true);
  assert.equal(result.healthy, false);
});

test("returns healthy when AGENTS.md exists and codex command is available", () => {
  const result = checkCodexHealth("/tmp/project", {
    hasCodexCommand: true,
    fileExists: () => true,
    readFile: () => "# Spectra Adapter (Codex)\n"
  });

  assert.equal(result.detected, true);
  assert.equal(result.healthy, true);
});
