import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installSpectra } from "./install.js";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("installSpectra fails fast when codex adapter is requested without codex on PATH", () => {
  const targetDir = makeTempDir("spectra-install-fail-");

  const previousCommand = process.env.SPECTRA_CODEX_COMMAND;
  process.env.SPECTRA_CODEX_COMMAND = "spectra-codex-command-that-does-not-exist";

  try {
    assert.throws(
      () => installSpectra({ targetDir, gitMode: "shared", agents: "codex" }),
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
