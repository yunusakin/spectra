import { getCliVersion } from "./version.js";

const SCHEMA_VERSION = 3;

function createInstallMetadata({ version = getCliVersion(), gitMode = "local", installMode = null, previous = null, now = new Date().toISOString() } = {}) {
  return {
    ...previous,
    ...(previous ? { updatedAt: now } : { createdWith: version }),
    installedAt: previous?.installedAt ?? now,
    cliVersion: version,
    runtimeVersion: version,
    schemaVersion: SCHEMA_VERSION,
    gitMode,
    ...(installMode ? { installMode } : {})
  };
}

export { SCHEMA_VERSION, createInstallMetadata };
