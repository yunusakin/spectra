import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { findSpectraRoot, readInstallMetadata } from "../lib/runtime.js";
import { getProjectLayout } from "../lib/project-layout.js";
import { getCliVersion } from "../lib/version.js";
import { migrateLegacyLayout } from "../lib/migration.js";
import { installSpectra } from "../lib/install.js";
import { ok, title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { validateCommand } from "./validate.js";
import { compareVersions, latestVersion, resolveInstalledNativeCommand, runSelfUpdate } from "../lib/update.js";

function needsLegacyMigration(projectRoot) {
  const layout = getProjectLayout(projectRoot);
  return !fs.existsSync(layout.installMetadata) &&
    (fs.existsSync(path.join(projectRoot, ".spectra", "install.json")) || fs.existsSync(path.join(projectRoot, "sdd")));
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
  ok("Update complete.");
  return validateCommand(["--cwd", projectRoot]);
}

async function updateCommand(argv) {
  const { options } = parseOptions(argv, { booleanFlags: ["--help"], stringFlags: ["--cwd"] });
  if (options["--help"]) {
    title("Usage: spectra update [--cwd <path>]");
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
  const cliOutdated = compareVersions(current, latest) < 0;

  if (!migrationRequired && !runtimeOutdated && !cliOutdated) {
    ok("Spectra is already up to date.");
    return 0;
  }

  const details = cliOutdated
    ? `A newer Spectra version is available: ${latest}. This will update the CLI and project runtime.`
    : "This will update the Spectra project runtime and migrate its layout if needed.";
  if (!(await confirmUpdate(details))) {
    title("Update cancelled.");
    return 0;
  }

  if (cliOutdated) {
    return runSelfUpdate(latest, projectRoot);
  }
  if (migrationRequired) {
    migrateLegacyLayout(projectRoot);
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
  if (needsLegacyMigration(projectRoot)) {
    migrateLegacyLayout(projectRoot);
  }
  return finishProjectUpdate(projectRoot);
}

export { internalUpdateProjectCommand, updateCommand };
