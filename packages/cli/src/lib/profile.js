import { getCliVersion } from "./version.js";

const PROFILES = new Set(["lite", "full"]);
const SCHEMA_VERSION = 2;

function normalizeProfile(profile) {
  const normalized = profile ?? "lite";
  if (!PROFILES.has(normalized)) {
    throw new Error("--profile must be lite or full");
  }
  return normalized;
}

function createInstallMetadata({ profile, version = getCliVersion(), gitMode = "local", installMode = null } = {}) {
  return {
    profile: normalizeProfile(profile),
    cliVersion: version,
    runtimeVersion: version,
    schemaVersion: SCHEMA_VERSION,
    gitMode,
    ...(installMode ? { installMode } : {})
  };
}

export { SCHEMA_VERSION, createInstallMetadata, normalizeProfile };
