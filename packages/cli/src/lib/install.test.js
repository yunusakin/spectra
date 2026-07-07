import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installSpectra } from "./install.js";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function withFakeCodex(fn) {
  const binDir = makeTempDir("spectra-codex-bin-");
  const codexPath = path.join(binDir, "codex");
  fs.writeFileSync(codexPath, "#!/usr/bin/env sh\nexit 0\n");
  fs.chmodSync(codexPath, 0o755);

  const previousPath = process.env.PATH ?? "";
  process.env.PATH = `${binDir}${path.delimiter}${previousPath}`;

  try {
    return fn();
  } finally {
    process.env.PATH = previousPath;
    fs.rmSync(binDir, { recursive: true, force: true });
  }
}

test("installSpectra fails fast when codex adapter is requested without codex on PATH", () => {
  const targetDir = makeTempDir("spectra-install-fail-");

  const previousCommand = process.env.SPECTRA_CODEX_COMMAND;
  process.env.SPECTRA_CODEX_COMMAND = "spectra-codex-command-that-does-not-exist";

  try {
    assert.throws(
      () => installSpectra({ targetDir, agents: "codex" }),
      /Agent setup is unhealthy: Codex: .*missing from PATH/
    );
  } finally {
    if (previousCommand === undefined) {
      delete process.env.SPECTRA_CODEX_COMMAND;
    } else {
      process.env.SPECTRA_CODEX_COMMAND = previousCommand;
    }
  }
});

test("installSpectra succeeds when codex adapter is requested and codex is available", () => {
  const targetDir = makeTempDir("spectra-install-pass-");

  withFakeCodex(() => {
    const result = installSpectra({ targetDir, agents: "codex" });
    assert.equal(result.installed, true);
    assert.equal(fs.existsSync(path.join(targetDir, "AGENTS.md")), true);
  });
});

test("installSpectra succeeds for non-Codex agents when adapter files are generated", () => {
  const targetDir = makeTempDir("spectra-install-claude-pass-");
  const result = installSpectra({ targetDir, agents: "claude,copilot" });

  assert.equal(result.installed, true);
  assert.equal(fs.existsSync(path.join(targetDir, "CLAUDE.md")), true);
  assert.equal(fs.existsSync(path.join(targetDir, ".github", "copilot-instructions.md")), true);
});
