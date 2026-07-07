import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adaptersGenerateCommand } from "./adapters-generate.js";

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

test("adaptersGenerateCommand fails fast when codex adapter is unhealthy", () => {
  const targetDir = makeTempDir("spectra-adapters-fail-");

  const previousCommand = process.env.SPECTRA_CODEX_COMMAND;
  process.env.SPECTRA_CODEX_COMMAND = "spectra-codex-command-that-does-not-exist";

  try {
    assert.throws(
      () => adaptersGenerateCommand(["--cwd", process.cwd(), "--agents", "codex", "--target", targetDir]),
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

test("adaptersGenerateCommand succeeds when codex adapter is healthy", () => {
  const targetDir = makeTempDir("spectra-adapters-pass-");

  withFakeCodex(() => {
    const status = adaptersGenerateCommand(["--cwd", process.cwd(), "--agents", "codex", "--target", targetDir]);
    assert.equal(status, 0);
    assert.equal(fs.existsSync(path.join(targetDir, "AGENTS.md")), true);
  });
});

test("adaptersGenerateCommand succeeds for multi-agent non-Codex output", () => {
  const targetDir = makeTempDir("spectra-adapters-multi-pass-");
  const status = adaptersGenerateCommand(["--cwd", process.cwd(), "--agents", "claude,cursor,windsurf,copilot,antigravity", "--target", targetDir]);

  assert.equal(status, 0);
  assert.equal(fs.existsSync(path.join(targetDir, "CLAUDE.md")), true);
  assert.equal(fs.existsSync(path.join(targetDir, ".cursor", "rules", "spectra-core.mdc")), true);
  assert.equal(fs.existsSync(path.join(targetDir, ".windsurf", "rules", "spectra-core.md")), true);
  assert.equal(fs.existsSync(path.join(targetDir, ".github", "copilot-instructions.md")), true);
  assert.equal(fs.existsSync(path.join(targetDir, ".agent", "rules", "spectra-core.md")), true);
});
