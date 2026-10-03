import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { isSea } from "node:sea";
import { getCliPackageRoot } from "./runtime.js";
import { getCliVersion } from "./version.js";

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?(\+[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$/;
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function ownedTree(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(directory, entry.name), relative = path.relative(directory, file), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink: ${file}`);
    if (stat.isDirectory()) return [[relative + "/", stat.mode & 0o777], ...ownedTree(file).map(([name, mode, digest]) => digest === undefined ? [path.join(relative, name), mode] : [path.join(relative, name), mode, digest])];
    if (!stat.isFile()) throw new Error(`Unexpected file type: ${file}`);
    return [[relative, stat.mode & 0o777, hash(file)]];
  });
}
function expectedAssetLayout() {
  if (typeof SPECTRA_NATIVE_LAYOUT === "object") return new Set(SPECTRA_NATIVE_LAYOUT.filter(name => name.startsWith("assets/") && name !== "assets/"));
  const root = path.join(getCliPackageRoot(), "assets");
  const walk = (directory, prefix = "assets") => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? [name + "/", ...walk(path.join(directory, entry.name), name)] : [name];
  });
  return new Set(walk(root));
}
function assertOwnedAssets(directory) {
  const expected = expectedAssetLayout();
  const visit = (current, prefix = "assets") => fs.readdirSync(current, { withFileTypes: true }).flatMap(entry => {
    const name = `${prefix}/${entry.name}`, child = path.join(current, entry.name), stat = fs.lstatSync(child);
    if (stat.isSymbolicLink()) throw new Error(`Unexpected asset symlink: ${child}`);
    if (stat.isDirectory()) return [name + "/", ...visit(child, name)];
    if (!stat.isFile()) throw new Error(`Unexpected asset type: ${child}`);
    return [name];
  });
  const actual = visit(path.join(directory, "assets"));
  if (actual.length !== expected.size || actual.some(name => !expected.has(name))) throw new Error(`Unexpected runtime asset entry: ${directory}`);
}
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
function readOwnedVersion(home, commandPath, version, env = process.env, allowUnexpectedAssets = false) {
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
  let unexpectedAssets = false;
  try { assertOwnedAssets(directory); } catch (error) { if (!allowUnexpectedAssets) throw error; unexpectedAssets = true; }
  const rootEntries = fs.readdirSync(directory).sort();
  const recordTemps = rootEntries.filter(name => /^ownership\.env\.\d+-[a-f0-9]{12}\.tmp$/.test(name));
  for (const name of recordTemps) { const temp = fs.lstatSync(path.join(directory, name)); if (!temp.isFile() || temp.isSymbolicLink()) throw new Error(`Unsafe ownership stage: ${directory}/${name}`); }
  if (rootEntries.filter(name => !recordTemps.includes(name)).join("\0") !== ["LICENSE", "VERSION", "assets", "bin", "install.sh", "ownership.env"].sort().join("\0")) throw new Error(`Unexpected version entry: ${directory}`);
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
  const binDir = path.join(directory, "bin");
  const binEntries = fs.readdirSync(binDir).sort();
  const executableTemps = binEntries.filter(name => /^spectra(?:\.rollback)?\.\d+-[a-f0-9]{12}\.tmp$/.test(name));
  for (const name of executableTemps) { const temp = fs.lstatSync(path.join(binDir, name)); if (!temp.isFile() || temp.isSymbolicLink()) throw new Error(`Unsafe executable stage: ${binDir}/${name}`); }
  let rollbackPresent = Boolean(rollbackPath);
  if (!rollbackPresent) {
    const candidate = executablePath + ".rollback";
    try {
      const rollback = fs.lstatSync(candidate);
      if (!rollback.isFile() || rollback.isSymbolicLink() || hash(candidate) !== record.sha256) throw new Error(`Unrecognized rollback bytes: ${candidate}`);
      rollbackPresent = true;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const expectedBinEntries = ["spectra", ...(rollbackPresent ? ["spectra.rollback"] : [])].sort();
  if (binEntries.filter(name => !executableTemps.includes(name)).join("\0") !== expectedBinEntries.join("\0")) throw new Error(`Unexpected executable entry: ${directory}`);
  const executableSha256 = hash(executablePath);
  return { ...record, directory, recordPath, ...(unexpectedAssets ? { unexpectedAssets: true } : {}), ...(rollbackPath ? { rollbackPath, forwarded: executableSha256 === record.forwarderSha256, forwardingPending: executableSha256 === record.sha256 } : {}) };
}
function readMachineInstallation(home, env = process.env) {
  assertSafeInstallationPath(home, env);
  const recordPath = assertSafeInstallationPath(path.join(home, "installation.env"), env);
  const record = readRecord(recordPath, ["format", "method", "home", "commandPath", "currentVersion"]);
  if (record.method !== "native" || record.home !== home || !VERSION_PATTERN.test(record.currentVersion)) throw new Error("Machine ownership does not match installation home/version");
  // The command itself is the one expected symlink; all its parent components must be safe.
  assertSafeInstallationPath(path.dirname(record.commandPath), env);
  if (path.basename(record.commandPath) !== "spectra" || record.commandPath.startsWith(`${home}/`)) throw new Error("Unsafe machine command path");
  const current = readOwnedVersion(home, record.commandPath, record.currentVersion, env, true);
  if (!fs.lstatSync(record.commandPath).isSymbolicLink() || fs.readlinkSync(record.commandPath) !== current.executablePath) throw new Error("Machine activation does not match ownership record");
  const versions = [current];
  const preserved = current.unexpectedAssets ? [current.directory] : [];
  for (const entry of fs.readdirSync(home)) {
    if (entry === "installation.env") continue;
    if (entry === record.currentVersion) continue;
    try { const version = readOwnedVersion(home, record.commandPath, entry, env); if (version.unexpectedAssets) preserved.push(version.directory); else versions.push(version); }
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

function validatePendingPlan(plan, home) {
  if (!plan || plan.home !== home || !Array.isArray(plan.versions) || !Array.isArray(plan.records) || plan.records.length !== 1 || !Array.isArray(plan.preserved)) throw new Error("Malformed pending uninstall plan");
  const machine = plan.records[0], machineLines = machine.contents?.split("\n");
  if (machine.path !== path.join(home, "installation.env") || machineLines?.length !== 6 || machineLines[0] !== "format=1" || machineLines[1] !== "method=native" || machineLines[2] !== `home=${home}` || machineLines[3] !== `commandPath=${plan.commandPath}` || !machineLines[4].startsWith("currentVersion=") || machineLines[5] !== "") throw new Error("Invalid pending machine record");
  const currentVersion = machineLines[4].slice("currentVersion=".length);
  if (!VERSION_PATTERN.test(currentVersion) || plan.commandTarget !== path.join(home, currentVersion, "bin/spectra") || !path.isAbsolute(plan.commandPath) || path.normalize(plan.commandPath) !== plan.commandPath || path.basename(plan.commandPath) !== "spectra" || plan.commandPath.startsWith(`${home}/`)) throw new Error("Pending uninstall paths do not match machine ownership");
  const allowed = new Set(["assets/", "bin/", "bin/spectra", "bin/spectra.rollback", "LICENSE", "VERSION", "install.sh", "ownership.env", ...expectedAssetLayout()]);
  const versions = new Set();
  for (const version of plan.versions) {
    if (!VERSION_PATTERN.test(version.version) || versions.has(version.version) || version.directory !== path.join(home, version.version) || !Number.isSafeInteger(version.dev) || !Number.isSafeInteger(version.ino) || !/^[a-f0-9]{64}$/.test(version.sha256) || typeof version.record !== "string" || !Array.isArray(version.tree)) throw new Error("Unsafe pending uninstall target");
    versions.add(version.version);
    const fields = Object.fromEntries(version.record.trimEnd().split("\n").map(line => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
    if (fields.format !== "1" || fields.method !== "native" || fields.home !== home || fields.commandPath !== plan.commandPath || fields.version !== version.version || fields.executablePath !== path.join(version.directory, "bin/spectra") || fields.sha256 !== version.sha256) throw new Error("Pending version record paths do not match");
    const entries = new Set();
    for (const entry of version.tree) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || entry[0].includes("\\") || (!allowed.has(entry[0]) && !(entry[0].endsWith("/") && [...allowed].some(name => name.startsWith(entry[0])))) || entries.has(entry[0])) throw new Error("Unsafe pending uninstall tree entry");
      entries.add(entry[0]);
      const directory = entry[0].endsWith("/"), relative = directory ? entry[0].slice(0, -1) : entry[0];
      if (!relative || path.isAbsolute(relative) || path.normalize(relative) !== relative || relative.split("/").some(part => !part || part === "." || part === "..") || !Number.isInteger(entry[1]) || entry[1] < 0 || entry[1] > 0o777 || (directory ? entry.length !== 2 : entry.length !== 3 || !/^[a-f0-9]{64}$/.test(entry[2]))) throw new Error("Malformed pending uninstall tree entry");
    }
    for (const required of ["bin/", "bin/spectra", "LICENSE", "VERSION", "install.sh", "ownership.env", "assets/"]) if (!entries.has(required)) throw new Error("Incomplete pending uninstall tree");
  }
  if (!versions.has(currentVersion)) throw new Error("Pending uninstall omits the active version");
  if (plan.manualRecovery !== undefined) {
    if (!Array.isArray(plan.manualRecovery)) throw new Error("Malformed pending uninstall recovery paths");
    for (const item of plan.manualRecovery) {
      const prefix = item && `.${item.version}.uninstall-`, basename = item && typeof item.path === "string" ? path.basename(item.path) : "";
      if (!item || !versions.has(item.version) || typeof item.path !== "string" || item.path !== path.join(home, basename) || !basename.startsWith(prefix) || !/^[a-f0-9]{12}$/.test(basename.slice(prefix.length))) throw new Error("Unsafe pending uninstall recovery path");
    }
  }
  return currentVersion;
}

function inspectApplicationInstallation({ env = process.env, execPath = process.execPath, packageRoot = getCliPackageRoot() } = {}) {
  let executable;
  try { executable = fs.realpathSync(execPath); } catch { executable = execPath; }
  // Derive a candidate from the actual executing binary. Env/project paths never
  // select a machine installation, and records must bind every canonical path.
  const candidateHome = path.resolve(path.dirname(executable), "../..");
  try {
    const markerPath = path.join(candidateHome, "uninstall.pending.json"), markerStat = fs.lstatSync(markerPath);
    if (!markerStat.isFile() || markerStat.isSymbolicLink()) throw new Error("Unsafe pending uninstall record");
    const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
    const plan = marker.plan, currentVersion = validatePendingPlan(plan, candidateHome), active = plan.versions.find(version => version.version === currentVersion), machine = plan.records[0];
    if (marker.format !== 1 || active.directory !== path.dirname(path.dirname(executable)) || path.join(active.directory, "bin/spectra") !== executable || !fs.lstatSync(executable).isFile() || fs.readFileSync(path.join(candidateHome, "installation.env"), "utf8") !== machine.contents) throw new Error("Invalid pending uninstall executable");
    try { const link = fs.lstatSync(plan.commandPath); if (!link.isSymbolicLink() || fs.readlinkSync(plan.commandPath) !== plan.commandTarget) throw new Error("Stable command changed during uninstall"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    return { ...plan, kind: "native-managed", home: candidateHome, execPath: executable, currentVersion: active.version, versions: plan.versions, preserved: plan.preserved, uninstallPending: true, pendingPlan: plan, reason: "Resuming verified machine uninstall" };
  } catch (error) {
    if (error.code !== "ENOENT" && fs.existsSync(path.join(candidateHome, "uninstall.pending.json"))) return { kind: "unmanaged", nativeRuntime: isSea(), execPath: executable, currentVersion: getCliVersion(), versions: [], reason: `Pending uninstall ownership is not verified: ${error.message}` };
  }
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
function planApplicationUninstall(installation) {
  if (installation.pendingPlan) return { ...installation.pendingPlan, pending: true };
  if (installation.kind !== "native-managed" || installation.legacy) throw new Error("Uninstall requires a verified managed native installation");
  const fresh = readMachineInstallation(installation.home);
  if (fresh.commandPath !== installation.commandPath) throw new Error("Native ownership changed before uninstall");
  const versions = fresh.versions.filter(version => !version.unexpectedAssets).map(version => {
    const rootEntries = fs.readdirSync(version.directory);
    const binEntries = fs.readdirSync(path.join(version.directory, "bin"));
    if (rootEntries.some(name => /^ownership\.env\.\d+-[a-f0-9]{12}\.tmp$/.test(name)) || binEntries.some(name => /^spectra(?:\.rollback)?\.\d+-[a-f0-9]{12}\.tmp$/.test(name))) throw new Error(`Incomplete update transaction; finish the update before uninstalling: ${version.directory}`);
    const stat = fs.lstatSync(version.directory);
    return { version: version.version, directory: version.directory, dev: stat.dev, ino: stat.ino, sha256: version.sha256, record: fs.readFileSync(version.recordPath, "utf8"), tree: ownedTree(version.directory) };
  });
  return { home: fresh.home, commandPath: fresh.commandPath, commandTarget: path.join(fresh.home, fresh.currentVersion, "bin/spectra"), versions,
    records: [{ path: fresh.recordPath, contents: fs.readFileSync(fresh.recordPath, "utf8") }], preserved: fresh.preserved };
}
function executeApplicationUninstall(plan) {
  const removed = [], preserved = [...plan.preserved];
  const pendingPath = path.join(plan.home, "uninstall.pending.json");
  const suppliedPlan = plan.pendingPlan ?? plan;
  const { pending: ignored, ...requestedPlan } = suppliedPlan;
  let pending = false;
  try {
    const markerStat = fs.lstatSync(pendingPath);
    if (!markerStat.isFile() || markerStat.isSymbolicLink()) throw new Error("Unsafe pending uninstall record");
    const marker = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
    if (marker.format !== 1 || JSON.stringify(marker.plan) !== JSON.stringify(requestedPlan)) throw new Error("Pending uninstall plan changed");
    pending = true;
    plan = marker.plan;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (plan.pending || plan.pendingPlan) throw new Error("Pending uninstall record is missing");
    plan = requestedPlan;
  }
  const activeVersion = path.basename(path.dirname(path.dirname(plan.commandTarget)));
  const machineRecord = plan.records.find(record => record.path === path.join(plan.home, "installation.env"));
  const activationMatches = (commandExpected = true) => {
    if (fs.readFileSync(machineRecord.path, "utf8") !== machineRecord.contents) return false;
    if (!commandExpected) {
      try { fs.lstatSync(plan.commandPath); return false; }
      catch (error) { return error.code === "ENOENT"; }
    }
    try { const link = fs.lstatSync(plan.commandPath); return link.isSymbolicLink() && fs.readlinkSync(plan.commandPath) === plan.commandTarget; }
    catch (error) { return pending && error.code === "ENOENT"; }
  };
  const versionMatches = target => {
    try {
      const current = readOwnedVersion(plan.home, plan.commandPath, target.version);
      const stat = fs.lstatSync(current.directory);
      return !stat.isSymbolicLink() && stat.dev === target.dev && stat.ino === target.ino && current.sha256 === target.sha256 && fs.readFileSync(current.recordPath, "utf8") === target.record && JSON.stringify(ownedTree(current.directory)) === JSON.stringify(target.tree);
    } catch { return false; }
  };
  const exists = file => { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } };
  const quarantineName = target => path.join(plan.home, `.${target.version}.uninstall-${randomBytes(6).toString("hex")}`);
  const restore = (target, quarantine) => {
    if (!exists(quarantine)) return false;
    try {
      if (exists(target.directory)) return false;
      fs.renameSync(quarantine, target.directory);
      return true;
    } catch { return false; }
  };
  const removeVersion = (target, commandExpected = true) => {
    if (!exists(target.directory)) { removed.push(target.directory); return true; }
    let quarantine;
    try {
      if (!activationMatches(commandExpected) || !versionMatches(target)) throw new Error("ownership changed");
      quarantine = quarantineName(target);
      fs.renameSync(target.directory, quarantine);
      const moved = fs.lstatSync(quarantine);
      if (moved.isSymbolicLink() || moved.dev !== target.dev || moved.ino !== target.ino || JSON.stringify(ownedTree(quarantine)) !== JSON.stringify(target.tree) || exists(target.directory) || !activationMatches(commandExpected)) {
        restore(target, quarantine);
        throw new Error("version changed during quarantine");
      }
      fs.rmSync(quarantine, { recursive: true });
      if (exists(target.directory)) preserved.push(target.directory);
      else removed.push(target.directory);
      return true;
    } catch {
      if (quarantine && exists(quarantine)) {
        let intact = false;
        try { intact = JSON.stringify(ownedTree(quarantine)) === JSON.stringify(target.tree); } catch { /* Preserve an unverifiable quarantine for manual recovery. */ }
        if (intact) {
          if (!restore(target, quarantine)) preserved.push(quarantine);
        } else {
          plan.manualRecovery = [...(plan.manualRecovery || []), { version: target.version, path: quarantine }];
          const temp = `${pendingPath}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`;
          fs.writeFileSync(temp, JSON.stringify({ format: 1, plan }) + "\n", { flag: "wx", mode: 0o600 });
          fs.renameSync(temp, pendingPath);
          preserved.push(quarantine);
        }
      }
      preserved.push(target.directory);
      return false;
    }
  };
  const activeTarget = plan.versions.find(item => item.version === activeVersion);
  if (!activeTarget) return { removed, preserved: [...new Set(preserved)] };
  try {
    if (!pending) {
      if (!activationMatches() || !versionMatches(activeTarget)) throw new Error("machine activation changed");
      fs.writeFileSync(pendingPath, JSON.stringify({ format: 1, plan }) + "\n", { flag: "wx", mode: 0o600 });
      pending = true;
    }
    const manual = plan.manualRecovery || [];
    if (manual.some(item => exists(item.path))) {
      const paths = manual.filter(item => exists(item.path)).map(item => item.path);
      preserved.push(...paths);
      return { removed, preserved: [...new Set(preserved)], manualRecovery: paths };
    }
    if (manual.length) {
      delete plan.manualRecovery;
      const temp = `${pendingPath}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ format: 1, plan }) + "\n", { flag: "wx", mode: 0o600 });
      fs.renameSync(temp, pendingPath);
    }
    const oldVersions = plan.versions.filter(target => target.version !== activeVersion);
    if (oldVersions.some(target => !removeVersion(target))) throw new Error("a retained version changed during uninstall");
    const actual = ownedTree(activeTarget.directory), expected = new Map(activeTarget.tree.map(entry => [entry[0], JSON.stringify(entry)]));
    if (actual.some(entry => expected.get(entry[0]) !== JSON.stringify(entry))) throw new Error("active version contents changed during uninstall");
    const keep = new Set(["bin/", "bin/spectra", "LICENSE", "VERSION", "install.sh", "ownership.env"]);
    for (const [name, mode, digest] of activeTarget.tree.filter(entry => !entry[0].endsWith("/") && !keep.has(entry[0]))) {
      const file = path.join(activeTarget.directory, name);
      if (!exists(file)) continue;
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== mode || hash(file) !== digest) throw new Error(`Active version file changed during uninstall: ${file}`);
      fs.unlinkSync(file);
    }
    for (const [name] of activeTarget.tree.filter(entry => entry[0].endsWith("/")).sort((a, b) => b[0].split(path.sep).length - a[0].split(path.sep).length)) {
      if (keep.has(name)) continue;
      const directory = path.join(activeTarget.directory, name.slice(0, -1));
      if (exists(directory)) fs.rmdirSync(directory);
    }
    if (!activationMatches() || exists(path.join(activeTarget.directory, "assets"))) throw new Error("active ownership changed before final removal");
    if (exists(plan.commandPath)) {
      if (!activationMatches()) throw new Error("stable command changed before final removal");
      fs.unlinkSync(plan.commandPath);
      removed.push(plan.commandPath);
    }
    for (const name of ["install.sh", "LICENSE", "VERSION", "ownership.env", "bin/spectra"]) {
      const file = path.join(activeTarget.directory, name);
      if (exists(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(path.join(activeTarget.directory, "bin"));
    fs.rmdirSync(activeTarget.directory);
    removed.push(activeTarget.directory);
    if (fs.readFileSync(machineRecord.path, "utf8") !== machineRecord.contents) throw new Error("machine record changed during uninstall");
    fs.unlinkSync(machineRecord.path);
    removed.push(machineRecord.path);
    fs.unlinkSync(pendingPath);
    removed.push(pendingPath);
    try { fs.rmdirSync(plan.home); } catch (error) { if (error.code !== "ENOENT") preserved.push(plan.home); }
  } catch {
    preserved.push(activeTarget.directory, plan.commandPath);
    if (pending && exists(pendingPath)) preserved.push(pendingPath);
  }
  return { removed, preserved: [...new Set(preserved)], manualRecovery: (plan.manualRecovery || []).filter(item => exists(item.path)).map(item => item.path) };
}
export { VERSION_PATTERN, assertSafeInstallationPath, readOwnedVersion, readMachineInstallation, resolveStableMachineCommand, forwardRetainedExecutables, inspectApplicationInstallation, planApplicationUpdate, planApplicationUninstall, executeApplicationUninstall, adoptLegacyNativeInstallation };
