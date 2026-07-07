import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const testDir = path.dirname(fileURLToPath(import.meta.url));

test("CLI entrypoint bundles as CommonJS for native SEA builds", async () => {
  const result = await build({
    entryPoints: [path.resolve(testDir, "..", "bin", "spectra.js")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    write: false,
    logLevel: "silent"
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.outputFiles.length, 1);
});
