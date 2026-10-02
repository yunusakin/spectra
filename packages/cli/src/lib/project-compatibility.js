import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { SCHEMA_VERSION } from "./install-metadata.js";
import { getCliVersion } from "./version.js";
import { detectLayout, hasProjectMarkers } from "./project-layout.js";

const MIGRATION_MARKER = ".spectra/migration.json";
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isSchema = value => Number.isSafeInteger(value) && value > 0;
const isRelativePath = value => typeof value === "string" && value.length > 0 &&
  !path.isAbsolute(value) && !/^[A-Za-z]:|\\|\0/.test(value) && !value.split("/").includes("..");

function inspectProjectCompatibility(projectRoot) {
  let root = path.resolve(projectRoot);
  if (fs.existsSync(root)) root = fs.realpathSync(root);
  const conflicts = [];
  const schemas = [];
  const authorities = [];
  let sourceRepository = false;
  const incompleteMigration = fs.lstatSync(path.join(root, MIGRATION_MARKER), { throwIfNoEntry: false }) !== undefined;
  const layout = detectLayout(root);
  const facts = {
    status: "NOT_SPECTRA_PROJECT", applicationVersion: getCliVersion(), projectSchemaVersion: null,
    currentSchemaVersion: SCHEMA_VERSION, minimumReadableSchema: SCHEMA_VERSION, maximumReadableSchema: SCHEMA_VERSION,
    // The migration registry supplies executable adjacent steps; inspection
    // reports known availability without inventing steps before it exists.
    layout, migrationAvailable: false, migrationPath: [], reason: "No Spectra project markers found.", conflicts,
    sourceRepository, incompleteMigration
  };
  const finish = (status, reason) => ({ ...facts, status, reason, sourceRepository });

  // Reject symlinks in authority paths before reading through them. Project-root
  // aliases are resolved above; state within that project must remain local.
  function safeAuthority(relative) {
    let current = root;
    for (const component of relative.split("/")) {
      current = path.join(current, component);
      if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
        conflicts.push(`Invalid symlink authority: ${relative}`);
        return false;
      }
    }
    return true;
  }
  function readAuthority(relative, parser) {
    if (!safeAuthority(relative) || !fs.existsSync(path.join(root, relative))) return null;
    try {
      const value = parser(fs.readFileSync(path.join(root, relative), "utf8"));
      if (!isObject(value)) throw new Error("expected an object");
      if (Object.hasOwn(value, "schemaVersion")) {
        if (!isSchema(value.schemaVersion)) conflicts.push(`Invalid schemaVersion in ${relative}: expected a positive safe integer.`);
        else schemas.push({ path: relative, value: value.schemaVersion });
      }
      if (value.gitMode !== undefined && !["local", "shared"].includes(value.gitMode)) conflicts.push(`Invalid gitMode in ${relative}.`);
      return value;
    } catch (error) {
      conflicts.push(`Malformed ${relative}: ${error.message}`);
      return null;
    }
  }

  for (const [name, prefix] of [["canonical", ".spectra/"], ["spectra-dir", "spectra/"], ["root-sdd", ""]]) {
    const manifest = `${prefix}sdd/system/manifest.env`;
    if (safeAuthority(manifest) && fs.existsSync(path.join(root, manifest))) {
      const content = fs.readFileSync(path.join(root, manifest), "utf8");
      authorities.push({ name, prefix, content });
      if (name === "root-sdd" && /^repo_mode=canonical\r?$/m.test(content)) sourceRepository = true;
    }
  }
  const metadata = [];
  const configs = [];
  for (const prefix of [".spectra/", "spectra/"]) {
    const value = readAuthority(`${prefix}install.json`, JSON.parse);
    if (value) {
      metadata.push({ prefix, value });
      for (const key of ["ownedPaths", "docsGuidePaths"]) {
        if (value[key] !== undefined && (!Array.isArray(value[key]) || !value[key].every(isRelativePath))) conflicts.push(`Invalid relative ${key} in ${prefix}install.json.`);
      }
      if (value.localLauncher !== undefined && !isRelativePath(value.localLauncher)) conflicts.push(`Invalid relative localLauncher in ${prefix}install.json.`);
      if (value.docsProjectName !== undefined && (typeof value.docsProjectName !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value.docsProjectName))) conflicts.push(`Invalid docsProjectName in ${prefix}install.json.`);
    }
    const config = readAuthority(`${prefix}config.yaml`, parse);
    if (config) configs.push({ prefix, value: config });
    if (value && config && value.gitMode !== undefined && config.gitMode !== undefined && value.gitMode !== config.gitMode) conflicts.push(`Conflicting gitMode in ${prefix} metadata and config.`);
  }
  facts.projectSchemaVersion = schemas.length ? Math.max(...schemas.map(schema => schema.value)) : null;
  if (new Set(schemas.map(schema => schema.value)).size > 1) conflicts.push("Conflicting schemaVersion authorities in project metadata/config.");
  if (authorities.length > 1) conflicts.push("Conflicting parallel Spectra layout authorities.");
  if (incompleteMigration) conflicts.push(`Incomplete migration marker: ${MIGRATION_MARKER}`);
  if (sourceRepository) return finish("BROKEN", "Refusing to modify a Spectra source repository (repo_mode=canonical).");
  // A brief staged before first install is user content, not an installed
  // schema authority. Generated system/contracts or metadata still mean that
  // a missing manifest is damage, and must never be silently bootstrapped.
  const installedState = hasProjectMarkers(root) && (authorities.length || incompleteMigration || [
    ".spectra/install.json", ".spectra/config.yaml", ".spectra/sdd/system", ".spectra/sdd/governance", ".spectra/sdd/features",
    "spectra/install.json", "spectra/config.yaml", "spectra/sdd/system", "spectra/sdd/governance", "spectra/sdd/features"
  ].some(relative => fs.lstatSync(path.join(root, relative), { throwIfNoEntry: false }) !== undefined));
  if (!installedState && !conflicts.length) return facts;
  if (!layout) conflicts.push("Missing Spectra project manifest.");
  const activePrefix = layout === "spectra-dir" ? "spectra/" : ".spectra/";
  const activeMetadata = metadata.find(entry => entry.prefix === activePrefix)?.value;
  // Only known consumer release/layout pairs establish unversioned history.
  const activeManifest = authorities.find(entry => entry.name === layout)?.content ?? "";
  const knownUnversioned = facts.projectSchemaVersion === null && layout !== "canonical" &&
    ((layout === "root-sdd" && /^spectra_version=2\.0\.3\r?$/m.test(activeManifest)) ||
     (layout === "spectra-dir" && /^spectra_version=3\.0\.8\r?$/m.test(activeManifest)));
  if (layout === "canonical" && !activeMetadata) conflicts.push("Missing install metadata for canonical Spectra project.");
  if (activeMetadata && !Object.hasOwn(activeMetadata, "schemaVersion") && !knownUnversioned) conflicts.push("Missing schemaVersion in install metadata; history is unknown.");
  if (facts.projectSchemaVersion === null && !knownUnversioned) conflicts.push("Missing project schemaVersion; history is unknown.");
  const inactivePrefix = activePrefix === ".spectra/" ? "spectra/" : ".spectra/";
  if (layout === "canonical" && (metadata.some(entry => entry.prefix === inactivePrefix) || configs.some(entry => entry.prefix === inactivePrefix))) conflicts.push("Conflicting legacy project authority beside canonical layout.");
  if (facts.projectSchemaVersion > SCHEMA_VERSION) return finish("TOO_NEW", `Project schema ${facts.projectSchemaVersion} is newer than this application supports (${SCHEMA_VERSION}); update Spectra.`);
  if (conflicts.length) return finish("BROKEN", conflicts.join(" "));
  if (layout !== "canonical") {
    facts.migrationAvailable = true;
    return finish("LEGACY_LAYOUT", "Legacy project layout requires explicit spectra migrate.");
  }
  if (facts.projectSchemaVersion < SCHEMA_VERSION) {
    facts.migrationAvailable = true;
    return finish("MIGRATION_REQUIRED", `Project schema ${facts.projectSchemaVersion} requires explicit spectra migrate to schema ${SCHEMA_VERSION}.`);
  }
  return finish("CURRENT", "Project schema and canonical layout are current.");
}

function assertProjectOperationAllowed(projectRoot, operation) {
  const compatibility = inspectProjectCompatibility(projectRoot);
  // Source-tree commands keep their existing parser/runtime behavior. The
  // installer guard remains unconditional, including stray consumer installs.
  if (compatibility.sourceRepository && compatibility.layout === "root-sdd" && !compatibility.conflicts.length &&
      !["init", "adopt", "install", "refresh", "doctor-fix", "adapters-target", "migrate"].includes(operation)) return compatibility;
  if (["status", "doctor", "migrate"].includes(operation) || compatibility.status === "CURRENT" ||
      (compatibility.status === "NOT_SPECTRA_PROJECT" && ["init", "adopt", "install", "adapters-target"].includes(operation))) return compatibility;
  const error = new Error(`${compatibility.status}: ${compatibility.reason}`);
  error.compatibility = compatibility;
  throw error;
}

export { MIGRATION_MARKER, inspectProjectCompatibility, assertProjectOperationAllowed };
