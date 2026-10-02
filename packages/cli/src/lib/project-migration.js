import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse, stringify } from "yaml";
import { inspectProjectCompatibility, MIGRATION_MARKER } from "./project-compatibility.js";
import { getProjectLayout, detectLayout } from "./project-layout.js";
import { migrateLegacyLayout, preflightLegacyMigration } from "./migration.js";
import { copyDirectory, getProjectAssetsDir, runInstalledScript } from "./runtime.js";
import { refreshProjectRuntimeForMigration } from "./install.js";
import { ensureV2Scaffolding, validateSpectraV2 } from "./specs.js";
import { validateBusinessContext } from "./business-context.js";

const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const exists = file => fs.lstatSync(file, { throwIfNoEntry: false }) !== undefined;
const relative = value => typeof value === "string" && value !== "" && !path.isAbsolute(value) && !value.split(/[\\/]/).includes("..") && !value.includes("\\") && !value.includes("\0");
function atomicWrite(file, content) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, content, { flag: "wx" });
  try { fs.renameSync(temporary, file); } finally { if (exists(temporary)) fs.unlinkSync(temporary); }
}
function walk(directory, visitor) {
  if (!exists(directory)) return;
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Unsafe migration symlink: ${directory}`);
  if (!fs.statSync(directory).isDirectory()) { visitor(directory); return; }
  for (const name of fs.readdirSync(directory).sort()) walk(path.join(directory, name), visitor);
}
const memory = root => copyDirectory(path.join(getProjectAssetsDir(), "sdd", "memory-bank"), path.join(getProjectLayout(root).sdd, "memory-bank"));
const validateMemory = root => {
  for (const file of ["business/INDEX.md", "tech/modules.md"]) if (!fs.existsSync(path.join(getProjectLayout(root).sdd, "memory-bank", file))) throw new Error(`Migration scaffold missing: ${file}`);
};
const registry = [
  { id: "layout", fromSchema: null, toSchema: null, preconditions: preflightLegacyMigration, mutation: migrateLegacyLayout,
    validation: root => { if (detectLayout(root) !== "canonical") throw new Error("Canonical layout migration failed."); } },
  { id: "unversioned-to-1", fromSchema: null, toSchema: 1, preconditions: () => {}, mutation: () => {}, validation: () => {} },
  { id: "1-to-2", fromSchema: 1, toSchema: 2, preconditions: () => {}, mutation: memory, validation: validateMemory },
  { id: "2-to-3", fromSchema: 2, toSchema: 3, preconditions: () => {}, mutation: root => { memory(root); ensureV2Scaffolding(getProjectLayout(root).root); }, validation: validateMemory }
];
function projectMigrationPath(schema, layout) {
  const ids = [];
  if (layout && layout !== "canonical") ids.push("layout");
  if (schema === null) ids.push("unversioned-to-1");
  for (let version = schema ?? 1; version < 3; version++) ids.push(`${version}-to-${version + 1}`);
  return ids;
}
function checkInputs(root) {
  return preflightLegacyMigration(root);
}
function planProjectMigration(projectRoot) {
  const root = fs.realpathSync(projectRoot);
  const compatibility = inspectProjectCompatibility(root);
  const conflicts = [...compatibility.conflicts];
  if (compatibility.incompleteMigration) return { compatibility, steps: [], conflicts, required: true, resume: true };
  if (!["CURRENT", "LEGACY_LAYOUT", "MIGRATION_REQUIRED"].includes(compatibility.status)) {
    if (!conflicts.length) conflicts.push(compatibility.reason);
  } else {
    try { checkInputs(root); } catch (error) { conflicts.push(error.message); }
  }
  const steps = compatibility.status === "CURRENT" || conflicts.length ? [] : projectMigrationPath(compatibility.projectSchemaVersion, compatibility.layout).map(id => {
    const { fromSchema, toSchema } = registry.find(step => step.id === id); return { id, fromSchema, toSchema };
  });
  return { compatibility: { ...compatibility, migrationPath: steps.map(step => step.id) }, steps, conflicts, required: steps.length > 0 };
}
function snapshot(root, marker, legacy) {
  const layout = getProjectLayout(root);
  const recovery = fs.mkdtempSync(path.join(layout.root, "recovery", "migration-"));
  marker.recoveryPath = path.relative(root, recovery);
  const metadataPath = path.join(root, marker.originalLayout === "spectra-dir" ? "spectra/install.json" : ".spectra/install.json");
  const metadata = exists(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : {};
  const generated = new Set();
  walk(path.join(getProjectAssetsDir(), "sdd/system"), file => generated.add(`sdd/system/${path.relative(path.join(getProjectAssetsDir(), "sdd/system"), file)}`));
  for (const guide of metadata.docsGuidePaths ?? []) generated.add(`docs/spectra/${guide}`);
  const files = [];
  const save = (file, sourcePath, targetPath, kind = "project") => {
    const bytes = fs.readFileSync(file); const backup = `files/${files.length}`;
    fs.mkdirSync(path.dirname(path.join(recovery, backup)), { recursive: true }); fs.writeFileSync(path.join(recovery, backup), bytes);
    files.push({ sourcePath, targetPath, kind, backup, sha256: hash(bytes) });
  };
  for (const name of [".spectra", "spectra", "sdd"]) walk(path.join(root, name), file => {
    const original = path.relative(root, file);
    const within = name === "sdd" ? original : path.relative(path.join(root, name), file);
    if (within.startsWith("recovery/") || within === "migration.json" || within === "migration.resume" || within.startsWith("cli/") || within.startsWith("cache/") || ["bin/spectra", "bin/spectra.cmd"].includes(within) || generated.has(within)) return;
    save(file, original, name === "sdd" ? `.spectra/${original}` : `.spectra/${within}`);
  });
  for (const [source, target] of legacy.moves.filter(([source]) => source.startsWith(path.join(root, "docs") + path.sep))) walk(source, file => save(file, path.relative(root, file), path.relative(root, target)));
  if (legacy.excludePath && exists(legacy.excludePath)) save(legacy.excludePath, "git-exclude", "git-exclude", "git-exclude");
  fs.writeFileSync(path.join(recovery, "manifest.json"), JSON.stringify({ projectRoot: root, files }, null, 2));
  marker.snapshotHash = hash(fs.readFileSync(path.join(recovery, "manifest.json")));
}
function readSnapshot(root, marker) {
  if (!relative(marker.recoveryPath) || !marker.recoveryPath.startsWith(".spectra/recovery/migration-")) throw new Error("Invalid recovery path; manual recovery required.");
  const recovery = path.join(root, marker.recoveryPath);
  const manifestPath = path.join(recovery, "manifest.json");
  const bytes = fs.readFileSync(manifestPath);
  if (hash(bytes) !== marker.snapshotHash) throw new Error("Recovery manifest changed; manual recovery required.");
  const manifest = JSON.parse(bytes);
  if (manifest.projectRoot !== root || !Array.isArray(manifest.files)) throw new Error("Invalid recovery manifest.");
  for (const file of manifest.files) {
    if (!relative(file.backup) || !relative(file.sourcePath) || !relative(file.targetPath)) throw new Error("Invalid snapshot path.");
    if (hash(fs.readFileSync(path.join(recovery, file.backup))) !== file.sha256) throw new Error("Recovery snapshot changed; manual recovery required.");
  }
  return manifest.files;
}
function verifyValues(root, marker, files) {
  for (const file of files) {
    if (file.kind === "git-exclude" || [".spectra/install.json", ".spectra/config.yaml", "spectra/install.json", "spectra/config.yaml"].includes(file.sourcePath)) continue;
    const candidate = marker.completed.includes("layout") || marker.originalLayout === "canonical" ? file.targetPath : file.sourcePath;
    if (!exists(path.join(root, candidate)) || hash(fs.readFileSync(path.join(root, candidate))) !== file.sha256) throw new Error(`Valuable content changed: ${candidate}; manual recovery required.`);
  }
}
function authorityHashes(root) {
  return Object.fromEntries([".spectra/install.json", ".spectra/config.yaml", ".spectra/sdd/system/manifest.env", "spectra/install.json", "spectra/config.yaml", "spectra/sdd/system/manifest.env", "sdd/system/manifest.env"].filter(file => exists(path.join(root, file))).map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
}
function validateProject(root) {
  const errors = validateBusinessContext(root);
  const logs = [];
  if (errors.length) return { status: "failed", logs: errors.join("\n") };
  for (const scriptName of ["validate-repo.sh", "check-policy.sh"]) {
    const result = runInstalledScript({ cwd: root, scriptName, args: scriptName === "validate-repo.sh" ? ["--strict"] : [], capture: true });
    logs.push(result.stdout ?? "", result.stderr ?? "");
    if (result.status !== 0) return { status: "failed", logs: logs.join("\n") + (scriptName === "check-policy.sh" ? "\nPolicy checks failed" : "\nRepo validation failed") };
  }
  const v2 = validateSpectraV2(root);
  if (!v2.ok) return { status: "failed", logs: [...logs, ...v2.errors].join("\n") };
  return { status: "passed", logs: [...logs, "Validation and policy checks passed"].join("\n") };
}
function executeProjectMigration(projectRoot, plan) {
  const root = fs.realpathSync(projectRoot); const layout = getProjectLayout(root); const markerPath = path.join(root, MIGRATION_MARKER);
  let marker; let resumeLock = null; let files;
  const result = (status, reason, validationStatus = "not-run", logs = "") => ({ status, reason, projectSchemaVersion: inspectProjectCompatibility(root).projectSchemaVersion, recoveryPath: marker?.recoveryPath ?? null, phase: marker?.phase ?? null, validationStatus, logs });
  try {
    // Re-plan at execution time; caller-supplied/stale steps cannot authorize work.
    plan = planProjectMigration(root);
    if (plan.resume) {
      checkInputs(root);
      marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      if (marker.projectRoot !== root || !Number.isSafeInteger(marker.ownerPid) || marker.ownerPid <= 0 || !/^[0-9a-f-]{36}$/.test(marker.id ?? "") || !Array.isArray(marker.completed) || !Array.isArray(marker.steps) || marker.steps.some(id => !registry.some(step => step.id === id))) throw new Error("Invalid migration marker; manual recovery required.");
      if (marker.ownerPid !== process.pid) {
        try { process.kill(marker.ownerPid, 0); throw new Error("Migration is still active in another process."); } catch (error) { if (error.code !== "ESRCH") throw error; }
      }
      // A second concurrent resume fails closed. An interrupted resume leaves
      // this lock for manual removal after verifying its owner is no longer live.
      fs.writeFileSync(`${markerPath}.resume`, String(process.pid), { flag: "wx" }); resumeLock = `${markerPath}.resume`;
      files = readSnapshot(root, marker); verifyValues(root, marker, files);
      if (marker.phase === "layout") {
        if (detectLayout(root) !== marker.originalLayout) throw new Error("Interrupted layout mutation requires manual recovery.");
        preflightLegacyMigration(root);
      } else if (marker.phase === "schema-commit") {
        const pending = marker.pending;
        if (!pending || ![1, 2, 3].includes(pending.schema)) throw new Error("Invalid pending schema commit.");
        for (const [file, bytes] of [[".spectra/install.json", pending.metadata], [".spectra/config.yaml", pending.config]]) {
          const actual = exists(path.join(root, file)) ? hash(fs.readFileSync(path.join(root, file))) : null;
          if (actual !== marker.checkpoint[file] && actual !== hash(bytes)) throw new Error("Schema authority changed; manual recovery required.");
        }
      } else if (marker.phase === "refresh") {
        const actual = authorityHashes(root);
        for (const file of new Set([...Object.keys(actual), ...Object.keys(marker.checkpoint)])) {
          if (actual[file] !== marker.checkpoint[file] && !marker.refreshExpected?.[file]?.includes(actual[file])) throw new Error("Project authority changed; manual recovery required.");
        }
      } else if (JSON.stringify(authorityHashes(root)) !== JSON.stringify(marker.checkpoint)) throw new Error("Project authority changed; manual recovery required.");
      marker.ownerPid = process.pid;
    } else {
      if (plan.conflicts.length) return result("incompatible", plan.conflicts.join(" "));
      if (!plan.required) return result("current", "Project is already current.", "not-needed");
      marker = { id: crypto.randomUUID(), projectRoot: root, ownerPid: process.pid, originalLayout: plan.compatibility.layout,
        originalSchema: plan.compatibility.projectSchemaVersion, steps: plan.steps.map(step => step.id), completed: [], phase: "snapshot" };
      fs.mkdirSync(layout.root, { recursive: true }); fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2), { flag: "wx" });
      fs.mkdirSync(path.join(layout.root, "recovery"), { recursive: true }); snapshot(root, marker, checkInputs(root)); files = readSnapshot(root, marker);
      marker.checkpoint = authorityHashes(root);
    }
    const progress = phase => { marker.phase = phase; atomicWrite(markerPath, JSON.stringify(marker, null, 2)); };
    const commitPending = () => {
      atomicWrite(layout.installMetadata, marker.pending.metadata); atomicWrite(layout.config, marker.pending.config);
      const step = marker.steps.find(id => !marker.completed.includes(id)); marker.completed.push(step); delete marker.pending;
      marker.checkpoint = authorityHashes(root); progress("step-complete");
    };
    if (marker.phase === "schema-commit") commitPending();
    for (const id of marker.steps.filter(id => !marker.completed.includes(id))) {
      const step = registry.find(step => step.id === id);
      progress(id === "layout" ? "layout" : "step-mutation"); step.preconditions(root); step.mutation(root);
      progress("step-validation"); step.validation(root); verifyValues(root, { ...marker, completed: id === "layout" ? [...marker.completed, id] : marker.completed }, files);
      if (step.toSchema !== null) {
        const metadata = JSON.parse(fs.readFileSync(layout.installMetadata, "utf8"));
        const config = exists(layout.config) ? parse(fs.readFileSync(layout.config, "utf8")) : {};
        metadata.schemaVersion = step.toSchema; config.schemaVersion = step.toSchema; config.gitMode = metadata.gitMode ?? "shared";
        if (step.toSchema === 3) { delete metadata.profile; delete config.profile; }
        marker.pending = { schema: step.toSchema, metadata: JSON.stringify(metadata, null, 2), config: stringify(config) };
        progress("schema-commit"); commitPending();
      } else { marker.completed.push(id); marker.checkpoint = authorityHashes(root); progress("step-complete"); }
    }
    if (marker.phase !== "validation") {
      const manifest = fs.readFileSync(path.join(getProjectAssetsDir(), "sdd/system/manifest.env"), "utf8");
      marker.refreshExpected ??= {};
      marker.refreshExpected[".spectra/sdd/system/manifest.env"] = [hash(manifest), hash(manifest.replace(/^repo_mode=.*$/m, "repo_mode=consumer"))];
      progress("refresh");
      const writeAuthority = (file, content) => {
        const relativeFile = path.relative(root, file);
        if (![".spectra/install.json", ".spectra/config.yaml"].includes(relativeFile)) throw new Error("Invalid migration refresh authority.");
        marker.refreshExpected[relativeFile] = [...new Set([...(marker.refreshExpected[relativeFile] ?? []), hash(content)])];
        progress("refresh"); atomicWrite(file, content);
      };
      refreshProjectRuntimeForMigration(root, marker.id, writeAuthority); verifyValues(root, marker, files);
      marker.checkpoint = authorityHashes(root); progress("validation");
    }
    const compatibility = inspectProjectCompatibility(root);
    if (compatibility.layout !== "canonical" || compatibility.projectSchemaVersion !== 3 || compatibility.sourceRepository || compatibility.conflicts.some(conflict => conflict !== `Incomplete migration marker: ${MIGRATION_MARKER}`)) throw new Error("Final schema consistency failed.");
    const validation = validateProject(root);
    if (validation.status !== "passed") return result("failed", "Migration applied, but post-migrate validation failed. Fix policy errors and resume with spectra migrate --yes.", "failed", validation.logs);
    verifyValues(root, marker, files); fs.unlinkSync(markerPath);
    return result("migrated", "Migration complete.", "passed", validation.logs);
  } catch (error) {
    return result("failed", `${error.message}. Recovery: ${marker?.recoveryPath ?? "no snapshot created"}.`, "not-run");
  } finally { if (resumeLock && exists(resumeLock)) fs.unlinkSync(resumeLock); }
}

export { registry as projectMigrationRegistry, projectMigrationPath, planProjectMigration, executeProjectMigration };
