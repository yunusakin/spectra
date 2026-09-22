import path from "node:path";
import { createInterface } from "node:readline/promises";
import { findSpectraRoot, readInstallMetadata } from "../lib/runtime.js";
import { getCliVersion } from "../lib/version.js";
import { migrateLegacyLayout, needsMigration } from "../lib/migration.js";
import { installSpectra } from "../lib/install.js";
import { SCHEMA_VERSION } from "../lib/profile.js";
import { ok, fail, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { validateCommand } from "./validate.js";
import { compareVersions, latestVersion, resolveInstalledNativeCommand, runSelfUpdate } from "../lib/update.js";

function needsLegacyMigration(projectRoot) {
  return needsMigration(projectRoot);
}

async function confirmUpdate(message) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question(`${message}\nContinue? [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    prompt.close();
  }
}

function refreshProjectRuntime(projectRoot) {
  const metadata = readInstallMetadata(projectRoot);
  if (!metadata) {
    throw new Error(`Missing Spectra installation metadata in ${projectRoot}`);
  }
  return installSpectra({
    targetDir: projectRoot,
    adopt: metadata.installMode === "adopt",
    gitMode: metadata.gitMode ?? "shared",
    profile: metadata.profile ?? "full",
    refresh: true
  });
}


function finishProjectUpdate(projectRoot) {
  refreshProjectRuntime(projectRoot);
  // Post-update validation runs before any completion message: success is
  // only reported once the updated project actually passes its checks, and
  // a validation failure is clearly distinguished from a migration failure.
  const validationStatus = validateCommand(["--cwd", projectRoot]);
  if (validationStatus !== 0) {
    fail("Update applied, but post-update validation failed. Run `spectra check` to re-validate.");
    return validationStatus;
  }
  ok("Update complete.");
  return 0;
}

function migrateBeforeUpdate(projectRoot) {
  try {
    migrateLegacyLayout(projectRoot);
  } catch (error) {
    fail(`Update failed during layout migration: ${error.message}`);
    return false;
  }
  return true;
}

async function updateCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--yes"],
    stringFlags: ["--cwd"]
  });
  if (options["--help"]) {
    title("Usage: spectra update [--cwd <path>] [--yes]");
    return 0;
  }
  const cwd = options["--cwd"] ?? process.cwd();
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }

  const current = getCliVersion();
  const latest = latestVersion();
  const metadata = readInstallMetadata(projectRoot);
  const migrationRequired = needsLegacyMigration(projectRoot);
  const runtimeOutdated = metadata?.runtimeVersion && compareVersions(metadata.runtimeVersion, current) < 0;
  const schemaOutdated = Number(metadata?.schemaVersion ?? 0) < SCHEMA_VERSION;
  const cliOutdated = compareVersions(current, latest) < 0;

  if (!migrationRequired && !runtimeOutdated && !schemaOutdated && !cliOutdated) {
    ok("Spectra is already up to date.");
    return 0;
  }

  const details = cliOutdated
    ? `A newer Spectra version is available: ${latest}. This will update the CLI and project runtime.`
    : "This will update the Spectra project runtime and migrate its layout if needed.";
  if (options["--yes"]) {
    title(details);
  } else if (!(await confirmUpdate(details))) {
    title("Update cancelled.");
    return 0;
  }

  if (cliOutdated) {
    return runSelfUpdate(latest, projectRoot);
  }
  if (migrationRequired && !migrateBeforeUpdate(projectRoot)) {
    return 1;
  }
  return finishProjectUpdate(projectRoot);
}

function internalUpdateProjectCommand(argv) {
  const { options } = parseOptions(argv, { booleanFlags: [], stringFlags: ["--cwd"] });
  const cwd = options["--cwd"] ?? process.cwd();
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }
  if (needsLegacyMigration(projectRoot) && !migrateBeforeUpdate(projectRoot)) {
    return 1;
  }
  return finishProjectUpdate(projectRoot);
}

export { internalUpdateProjectCommand, updateCommand };
