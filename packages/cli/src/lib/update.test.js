import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runSelfUpdate } from "./update.js";

test("native self-update installs into and reruns the active binary location", () => {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  };
  const execPath = "/opt/homebrew/bin/spectra";

  assert.equal(runSelfUpdate("3.0.2", "/tmp/project", { spawn, execPath, env: { HOME: "/tmp/home" } }), 0);
  assert.equal(calls[0].options.env.SPECTRA_BIN, path.dirname(execPath));
  assert.equal(calls[0].options.env.SPECTRA_VERSION, "v3.0.2");
  assert.equal(calls[1].command, execPath);
});

