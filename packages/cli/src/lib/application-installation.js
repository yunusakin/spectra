import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { isSea } from "node:sea";
import { getCliPackageRoot } from "./runtime.js";
import { getCliVersion } from "./version.js";

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?(\+[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$/;
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function assertSafeInstallationPath(value, env = process.env) {
  if (typeof value !== "string" || !path.isAbsolute(value) || path.normalize(value) !== value || value.includes("\n") || value.includes("\r")) throw new Error(`Unsafe installation path: ${value}`);
  const dangerous = new Set(["/", "/bin", "/usr", "/usr/bin", "/usr/local", "/etc", "/var", "/private", "/private/tmp", "/tmp", env.HOME, env.USERPROFILE]);
  if (dangerous.has(value)) throw new Error(`Unsafe installation path: ${value}`);
  for (let component = value; component !== path.dirname(component); component = path.dirname(component)) {
    try { if (fs.lstatSync(component).isSymbolicLink()) throw new Error(`Symlink installation path: ${component}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return value;
}
function readRecord(file, expectedKeys) {
  if (!fs.lstatSync(file).isFile()) throw new Error(`Unsafe ownership record: ${file}`);
  const contents = fs.readFileSync(file, "utf8");
  const lines = contents.split("\n");
  if (lines.pop() !== "" || lines.length !== expectedKeys.length) throw new Error(`Malformed ownership record: ${file}`);
  const record = {};
  lines.forEach((line, index) => {
    const key = expectedKeys[index];
    if (!line.startsWith(`${key}=`)) throw new Error(`Malformed ownership record: ${file}`);
    record[key] = line.slice(key.length + 1);
  });
  if (record.format !== "1" || !new Set(["native", "native-legacy"]).has(record.method)) throw new Error(`Unrecognized ownership record: ${file}`);
  return record;
}
function readOwnedVersion(home, commandPath, version, env = process.env) {
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid owned version: ${version}`);
  const directory = assertSafeInstallationPath(path.join(home, version), env);
  const executablePath = assertSafeInstallationPath(path.join(directory, "bin/spectra"), env);
  const recordPath = assertSafeInstallationPath(path.join(directory, "ownership.env"), env);
  const keys = ["format", "method", "home", "commandPath", "version", "executablePath", "sha256", "archiveSha256", "installerSha256"];
  if (fs.readFileSync(recordPath, "utf8").includes("\nforwarderSha256=")) keys.push("forwarderSha256");
  const record = readRecord(recordPath, keys);
  if (record.home !== home || record.commandPath !== commandPath || record.version !== version || record.executablePath !== executablePath || !(record.method === "native" ? /^[a-f0-9]{64}$/.test(record.archiveSha256) : record.archiveSha256 === "unknown")) throw new Error(`Ownership does not match version paths: ${directory}`);
  const versionPath = assertSafeInstallationPath(path.join(directory, "VERSION"), env);
  const installerPath = assertSafeInstallationPath(path.join(directory, "install.sh"), env);
  if (hash(installerPath) !== record.installerSha256) throw new Error(`Owned installer validation failed: ${directory}`);
  const assetsPath = assertSafeInstallationPath(path.join(directory, "assets/runtime"), env);
  if (!fs.statSync(assetsPath).isDirectory() || fs.readFileSync(versionPath, "utf8").trim() !== version || !fs.statSync(executablePath).isFile()) throw new Error(`Owned runtime validation failed: ${directory}`);
  let rollbackPath;
  if (Object.hasOwn(record, "forwarderSha256")) {
    rollbackPath = assertSafeInstallationPath(executablePath + ".rollback", env);
    const expected = "#!/bin/sh\nexec '" + commandPath.replaceAll("'", "'\\''") + "' \"$@\"\n";
    const expectedSha256 = createHash("sha256").update(expected).digest("hex");
    const rollback = fs.lstatSync(rollbackPath);
    const executableSha256 = hash(executablePath);
    if (!/^[a-f0-9]{64}$/.test(record.forwarderSha256) || record.forwarderSha256 !== expectedSha256 || !rollback.isFile() || rollback.isSymbolicLink() || hash(rollbackPath) !== record.sha256) throw new Error("Forwarded executable validation failed: " + directory);
    if (executableSha256 === record.forwarderSha256) {
      if (fs.readFileSync(executablePath, "utf8") !== expected) throw new Error("Forwarded executable target mismatch: " + directory);
    } else if (executableSha256 !== record.sha256) {
      throw new Error("Forwarded executable transaction mismatch: " + directory);
    }
  } else if (hash(executablePath) !== record.sha256) {
    throw new Error(`Owned runtime validation failed: ${directory}`);
  }
  const executableSha256 = hash(executablePath);
  return { ...record, directory, recordPath, ...(rollbackPath ? { rollbackPath, forwarded: executableSha256 === record.forwarderSha256, forwardingPending: executableSha256 === record.sha256 } : {}) };
}
function readMachineInstallation(home, env = process.env) {
  assertSafeInstallationPath(home, env);
  const recordPath = assertSafeInstallationPath(path.join(home, "installation.env"), env);
  const record = readRecord(recordPath, ["format", "method", "home", "commandPath", "currentVersion"]);
  if (record.method !== "native" || record.home !== home || !VERSION_PATTERN.test(record.currentVersion)) throw new Error("Machine ownership does not match installation home/version");
  // The command itself is the one expected symlink; all its parent components must be safe.
  assertSafeInstallationPath(path.dirname(record.commandPath), env);
  if (path.basename(record.commandPath) !== "spectra" || record.commandPath.startsWith(`${home}/`)) throw new Error("Unsafe machine command path");
  const current = readOwnedVersion(home, record.commandPath, record.currentVersion, env);
  if (!fs.lstatSync(record.commandPath).isSymbolicLink() || fs.readlinkSync(record.commandPath) !== current.executablePath) throw new Error("Machine activation does not match ownership record");
  const versions = [];
  const preserved = [];
  for (const entry of fs.readdirSync(home)) {
    if (entry === "installation.env") continue;
    try { versions.push(readOwnedVersion(home, record.commandPath, entry, env)); }
    catch { preserved.push(path.join(home, entry)); }
  }
  return { ...record, recordPath, versions, preserved };
}

function resolveStableMachineCommand(commandPath, env = process.env) {
  try {
    if (typeof commandPath !== "string" || !path.isAbsolute(commandPath) || path.normalize(commandPath) !== commandPath || path.basename(commandPath) !== "spectra") return null;
    assertSafeInstallationPath(path.dirname(commandPath), env);
    if (!fs.lstatSync(commandPath).isSymbolicLink()) return null;
    const target = fs.readlinkSync(commandPath);
    if (!path.isAbsolute(target)) return null;
    const home = path.resolve(path.dirname(target), "../..");
    const installation = readMachineInstallation(home, env);
    return installation.commandPath === commandPath ? commandPath : null;
  } catch {
    return null;
  }
}

function forwardRetainedExecutables(installation) {
  const current = readMachineInstallation(installation.home);
  if (current.commandPath !== installation.commandPath) throw new Error("Native command changed before retained launchers were forwarded");
  const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  for (const version of current.versions) {
    if (version.version === current.currentVersion || version.forwarded) continue;
    const fresh = readOwnedVersion(current.home, current.commandPath, version.version);
    const originalRecord = fs.readFileSync(fresh.recordPath, "utf8");
    const rollbackPath = fresh.executablePath + ".rollback";
    const forwarder = "#!/bin/sh\nexec " + shellQuote(current.commandPath) + " \"$@\"\n";
    const forwarderSha256 = createHash("sha256").update(forwarder).digest("hex");
    let reuseRollback = false;
    if (fresh.forwardingPending) {
      if (fresh.forwarderSha256 !== forwarderSha256 || hash(fresh.executablePath) !== fresh.sha256 || hash(fresh.rollbackPath) !== fresh.sha256) throw new Error("Cannot resume interrupted forwarding safely: " + fresh.directory);
    } else {
      if (hash(fresh.executablePath) !== fresh.sha256) throw new Error("Retained executable changed before forwarding: " + fresh.executablePath);
      try {
        const rollback = fs.lstatSync(rollbackPath);
        if (!rollback.isFile() || rollback.isSymbolicLink() || hash(rollbackPath) !== fresh.sha256) throw new Error("Unrecognized rollback bytes already exist: " + rollbackPath);
        const retry = readOwnedVersion(current.home, current.commandPath, version.version);
        if (retry.forwarded || retry.forwardingPending || retry.sha256 !== fresh.sha256 || hash(retry.executablePath) !== retry.sha256 || fs.readFileSync(retry.recordPath, "utf8") !== originalRecord) throw new Error("Cannot recover interrupted forwarding safely: " + fresh.directory);
        reuseRollback = true;
      }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    const suffix = process.pid + "-" + randomBytes(6).toString("hex");
    const forwardTemp = fresh.executablePath + "." + suffix + ".tmp";
    const rollbackTemp = rollbackPath + "." + suffix + ".tmp";
    const recordTemp = fresh.recordPath + "." + suffix + ".tmp";
    const record = fresh.forwardingPending ? originalRecord : originalRecord.trimEnd() + "\nforwarderSha256=" + forwarderSha256 + "\n";
    let saved = false;
    let markerCommitted = fresh.forwardingPending;
    try {
      fs.writeFileSync(forwardTemp, forwarder, { flag: "wx", mode: 0o755 });
      if (hash(forwardTemp) !== forwarderSha256) throw new Error("Forwarding stage verification failed: " + fresh.directory);
      if (!fresh.forwardingPending) {
        const originalBytes = fs.readFileSync(fresh.executablePath);
        if (!reuseRollback) fs.writeFileSync(rollbackTemp, originalBytes, { flag: "wx", mode: 0o755 });
        fs.writeFileSync(recordTemp, record, { flag: "wx", mode: 0o600 });
        if (!reuseRollback && hash(rollbackTemp) !== fresh.sha256) throw new Error("Rollback staging verification failed: " + fresh.directory);
        const latest = readOwnedVersion(current.home, current.commandPath, version.version);
        if (latest.forwarded || latest.forwardingPending || latest.sha256 !== fresh.sha256 || fs.readFileSync(latest.recordPath, "utf8") !== originalRecord) throw new Error("Retained ownership changed before forwarding: " + fresh.directory);
        if (reuseRollback) saved = true;
        else {
          try { fs.linkSync(rollbackTemp, rollbackPath); saved = true; }
          catch (error) { if (error.code !== "EEXIST") throw error; throw new Error("Rollback bytes already exist: " + rollbackPath); }
          fs.unlinkSync(rollbackTemp);
        }
        const beforeMarker = readOwnedVersion(current.home, current.commandPath, version.version);
        if (beforeMarker.sha256 !== fresh.sha256 || hash(beforeMarker.executablePath) !== fresh.sha256 || fs.readFileSync(beforeMarker.recordPath, "utf8") !== originalRecord || hash(rollbackPath) !== fresh.sha256) throw new Error("Retained ownership changed before forwarding marker: " + fresh.directory);
        fs.renameSync(recordTemp, fresh.recordPath);
        markerCommitted = true;
      }
      const pending = readOwnedVersion(current.home, current.commandPath, version.version);
      if (!pending.forwardingPending || pending.forwarderSha256 !== forwarderSha256 || hash(pending.rollbackPath) !== pending.sha256 || fs.readFileSync(pending.recordPath, "utf8") !== record) throw new Error("Forwarding transaction marker validation failed: " + fresh.directory);
      fs.renameSync(forwardTemp, fresh.executablePath);
      readOwnedVersion(current.home, current.commandPath, version.version);
    } catch (error) {
      // Once the ownership marker is committed, keep the validated rollback
      // bytes and marker so the next updater can finish the atomic executable swap.
      if (!markerCommitted && saved && hash(rollbackPath) !== fresh.sha256) throw new Error("Rollback bytes changed during forwarding: " + rollbackPath);
      throw error;
    } finally {
      for (const file of [rollbackTemp, forwardTemp, recordTemp]) {
        try { fs.unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
  }
  return readMachineInstallation(current.home);
}

function inspectLegacyNativeInstallation(executable, env) {
  if (!isSea() || fs.realpathSync(process.execPath) !== executable) throw new Error("Legacy adoption requires the actual executing native application");
  if (typeof SPECTRA_INSTALLER_SOURCE !== "string" || typeof SPECTRA_NATIVE_LAYOUT !== "object") throw new Error("This executable does not carry verified native bootstrap evidence");
  const version = getCliVersion();
  const directory = assertSafeInstallationPath(path.resolve(path.dirname(executable), ".."), env);
  const home = assertSafeInstallationPath(path.dirname(directory), env);
  if (!VERSION_PATTERN.test(version) || executable !== path.join(home, version, "bin/spectra")) throw new Error("Legacy executable is not in a canonical version runtime");
  const bin = env.SPECTRA_BIN || (env.HOME ? path.join(env.HOME, ".local/bin") : null);
  if (!bin) throw new Error("Legacy stable command location is unknown; provide SPECTRA_BIN");
  const commandPath = path.join(assertSafeInstallationPath(bin, env), "spectra");
  if (commandPath.startsWith(`${home}/`) || !fs.lstatSync(commandPath).isSymbolicLink() || fs.readlinkSync(commandPath) !== executable) throw new Error("Legacy stable command does not point to the executing native application");
  for (const record of [path.join(home, "installation.env")]) {
    try { fs.lstatSync(record); throw new Error(`Existing ownership data must not be replaced: ${record}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (fs.readFileSync(assertSafeInstallationPath(path.join(directory, "VERSION"), env), "utf8") !== `${version}\n`) throw new Error("Legacy VERSION does not match the executing application");
  const manifest = fs.readFileSync(assertSafeInstallationPath(path.join(directory, "assets/runtime/sdd/system/manifest.env"), env), "utf8");
  if (!manifest.split(/\r?\n/).includes(`spectra_version=${version}`)) throw new Error("Legacy runtime does not match the executing application version");
  let resuming = false;
  try { fs.lstatSync(path.join(directory, "ownership.env")); resuming = true; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const expected = new Set(["bin/", "bin/spectra", "VERSION", "LICENSE", "install.sh", ...SPECTRA_NATIVE_LAYOUT, ...(resuming ? ["ownership.env"] : [])]);
  const found = new Set();
  const visit = (dir, prefix = "") => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name); const stat = fs.lstatSync(file);
      const relative = `${prefix}${name}${stat.isDirectory() ? "/" : ""}`;
      if ((!stat.isFile() && !stat.isDirectory()) || !expected.has(relative)) throw new Error(`Unexpected legacy runtime content: ${relative}`);
      found.add(relative);
      if (stat.isDirectory()) visit(file, relative);
    }
  };
  visit(directory);
  for (const relative of expected) if (relative !== "install.sh" && !found.has(relative)) throw new Error(`Legacy runtime is incomplete: ${relative}`);
  if (found.has("install.sh") && fs.readFileSync(path.join(directory, "install.sh"), "utf8") !== SPECTRA_INSTALLER_SOURCE) throw new Error("Existing legacy installer cannot be verified from the executing application");
  const owned = { format: "1", method: "native-legacy", home, commandPath, version, executablePath: executable, sha256: hash(executable), archiveSha256: "unknown", installerSha256: createHash("sha256").update(SPECTRA_INSTALLER_SOURCE).digest("hex"), directory, recordPath: path.join(directory, "ownership.env") };
  if (resuming) {
    const existing = readOwnedVersion(home, commandPath, version, env);
    if (existing.method !== "native-legacy" || existing.installerSha256 !== owned.installerSha256) throw new Error("Interrupted legacy ownership does not match executing native evidence");
  }
  return { kind: "native-managed", legacy: true, resuming, home, commandPath, execPath: executable, currentVersion: version, activeVersion: version, versions: [owned], reason: "Executing native identity, VERSION, complete runtime layout and stable command are verified for adoption" };
}
function adoptLegacyNativeInstallation(installation) {
  if (!installation.legacy) return installation;
  const fresh = inspectLegacyNativeInstallation(installation.execPath, process.env);
  if (fresh.home !== installation.home || fresh.commandPath !== installation.commandPath || fresh.versions[0].sha256 !== installation.versions[0].sha256) throw new Error("Legacy native evidence changed before adoption");
  const serialize = (record, keys) => keys.map(key => `${key}=${record[key]}\n`).join("");
  const created = [];
  const create = (file, contents) => { assertSafeInstallationPath(file); fs.writeFileSync(file, contents, { flag: "wx", mode: 0o600 }); created.push({ file, contents }); };
  try {
    const owned = fresh.versions[0];
    const installer = path.join(owned.directory, "install.sh");
    if (!fs.existsSync(installer)) create(installer, SPECTRA_INSTALLER_SOURCE);
    if (!fresh.resuming) create(owned.recordPath, serialize(owned, ["format", "method", "home", "commandPath", "version", "executablePath", "sha256", "archiveSha256", "installerSha256"]));
    create(path.join(fresh.home, "installation.env"), serialize({ format: "1", method: "native", home: fresh.home, commandPath: fresh.commandPath, currentVersion: fresh.currentVersion }, ["format", "method", "home", "commandPath", "currentVersion"]));
    const managed = inspectApplicationInstallation();
    if (managed.kind !== "native-managed" || managed.legacy) throw new Error("Native adoption ownership changed before completion");
    return managed;
  } catch (error) {
    for (const { file, contents } of created.reverse()) {
      try { assertSafeInstallationPath(file); if (fs.lstatSync(file).isFile() && fs.readFileSync(file, "utf8") === contents) fs.unlinkSync(file); } catch { /* Preserve anything changed by another actor. */ }
    }
    throw error;
  }
}

function inspectApplicationInstallation({ env = process.env, execPath = process.execPath, packageRoot = getCliPackageRoot() } = {}) {
  let executable;
  try { executable = fs.realpathSync(execPath); } catch { executable = execPath; }
  // Derive a candidate from the actual executing binary. Env/project paths never
  // select a machine installation, and records must bind every canonical path.
  const candidateHome = path.resolve(path.dirname(executable), "../..");
  try {
    const machine = readMachineInstallation(candidateHome, env);
    const executing = machine.versions.find(version => version.executablePath === executable);
    if (!executing) throw new Error("Executing binary is not an owned installed version");
    if (executing.version !== getCliVersion()) throw new Error("Executing application version does not match its ownership record");
    return { ...machine, kind: "native-managed", home: candidateHome, execPath: executable, currentVersion: executing.version, activeVersion: machine.currentVersion, reason: "Executing binary and machine activation have verified native ownership" };
  } catch (error) {
    if (isSea()) {
      try { return inspectLegacyNativeInstallation(executable, env); }
      catch (legacyError) { return { kind: "unmanaged", nativeRuntime: true, execPath: executable, currentVersion: getCliVersion(), versions: [], reason: `Native installation ownership is not verified: ${error.message}. Legacy evidence rejected: ${legacyError.message}` }; }
    }
  }
  let root;
  try { root = fs.realpathSync(packageRoot); } catch { root = packageRoot; }
  let kind = "unmanaged";
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    if (manifest.name === "spectra-pack" && manifest.version === getCliVersion()) {
      if (root.includes(`${path.sep}.spectra${path.sep}cli`)) kind = "local-fallback";
      else if (root.includes(`${path.sep}_npx${path.sep}`)) kind = "npx";
      else if (root.endsWith(`${path.sep}node_modules${path.sep}spectra-pack`)) kind = "npm";
      else if (fs.existsSync(path.join(root, "../../package.json")) && root.endsWith(`${path.sep}packages${path.sep}cli`)) kind = "development";
    }
  } catch { /* An unrecognized executable/package never authorizes mutation. */ }
  return { kind, packageRoot: root, execPath: executable, currentVersion: getCliVersion(), versions: [], reason: `${kind} invocation has no managed native ownership` };
}
function planApplicationUpdate(installation, version) {
  version = String(version).replace(/^v/, "");
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid Spectra version: ${version}`);
  if (installation.kind !== "native-managed") return { kind: "instructions", version, installation };
  const fresh = inspectApplicationInstallation({ execPath: installation.execPath });
  if (fresh.kind !== "native-managed" || fresh.home !== installation.home || fresh.commandPath !== installation.commandPath) throw new Error("Native ownership changed before update");
  return { kind: "native-managed", version, home: fresh.home, commandPath: fresh.commandPath, currentVersion: fresh.currentVersion, installation: fresh };
}
export { VERSION_PATTERN, assertSafeInstallationPath, readOwnedVersion, readMachineInstallation, resolveStableMachineCommand, forwardRetainedExecutables, inspectApplicationInstallation, planApplicationUpdate, adoptLegacyNativeInstallation };
