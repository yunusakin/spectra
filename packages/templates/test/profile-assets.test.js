import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getProfileTemplateDir } from "../src/index.js";

test("template package resolves Lite and Full profile assets", () => {
  for (const profile of ["lite", "full"]) {
    const root = getProfileTemplateDir(profile);
    assert.equal(fs.existsSync(path.join(root, "profile.yaml")), true);
  }
});

test("template package rejects unsupported profile assets", () => {
  assert.throws(() => getProfileTemplateDir("enterprise"), /Unsupported Spectra profile/);
});
