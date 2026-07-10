import assert from "node:assert/strict";
import test from "node:test";
import { createInstallMetadata, normalizeProfile } from "../src/lib/profile.js";

test("profile defaults to Lite", () => {
  assert.equal(normalizeProfile(undefined), "lite");
});

test("profile metadata records profile, runtime, schema, and Git mode", () => {
  assert.deepEqual(
    createInstallMetadata({ profile: "full", version: "2.0.3", gitMode: "local" }),
    {
      profile: "full",
      cliVersion: "2.0.3",
      runtimeVersion: "2.0.3",
      schemaVersion: 1,
      gitMode: "local"
    }
  );
});
