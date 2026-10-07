import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { readMachineInstallation } from "../src/lib/application-installation.js";

// Failure modes, before implementation: checksum/archive traversal, unsafe VERSION,
// foreign command/version replacement, root symlinks, smoke/version mismatch,
// interrupted stage/activation, deleted prior activation, guessed provenance,
// shared-file loss, custom-path failure, project mutation during application update,
// a committed forwarder marker with the original executable after process death,
// mismatched transaction marker/rollback/executable hashes, nested user data under
// an owned runtime, active-removal failure after unlink, and target replacement
// between validation and recursive deletion, plus pending-uninstall traversal
// tampering and retained-version removal failure/retry.
// Build the real archive first: npm run build:native --workspace spectra-pack.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const asset = `spectra-${process.platform}-${process.arch}.tar.gz`;
const archive = process.env.SPECTRA_NATIVE_ARCHIVE || path.join(repo, "packages/cli/dist/native", asset);
const available = fs.existsSync(archive);
const artifactRoot = process.env.SPECTRA_NATIVE_ARTIFACT_DIR || fs.realpathSync(os.tmpdir());
fs.mkdirSync(artifactRoot, { recursive: true });
const root = fs.mkdtempSync(path.join(artifactRoot, "spectra-native-e2e-"));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const report = { sourceSha: spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim(), archive, scenarios: [] };
const save = () => fs.writeFileSync(path.join(root, "results.json"), JSON.stringify(report, null, 2) + "\n");
function inventory(dir) {
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.name === ".git") { const exclude = path.join(file, "info/exclude"); return fs.existsSync(exclude) ? [[".git/info/exclude", hash(exclude)]] : []; }
    if (entry.isDirectory()) return Object.entries(inventory(file)).map(([name, digest]) => [`${entry.name}/${name}`, digest]);
    return [[entry.name, entry.isSymbolicLink() ? { link: fs.readlinkSync(file) } : hash(file)]];
  }));
}
function scenario(name, action) {
  test(`native installer: ${name}`, { skip: !available && "Build the native release archive before running transport E2E" }, t => {
    const dir = fs.mkdtempSync(path.join(root, "case-"));
    const entry = { name, dir, commands: [], passed: false }; report.scenarios.push(entry);
    const run = (command, args, env = {}) => {
      const result = spawnSync(command, args, { cwd: dir, env: { ...process.env, ...env }, encoding: "utf8", timeout: 90000 });
      entry.commands.push({ command, args, status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message }); save(); return result;
    };
    const transport = path.join(dir, "transport"); fs.mkdirSync(transport);
    fs.writeFileSync(path.join(transport, "curl"), `#!/bin/sh\nset -eu\ncase "$2" in\n*/install.sh) cp "$SPECTRA_E2E_INSTALLER" "$4" ;;\n*.sha256) cp "$SPECTRA_E2E_ARCHIVE.sha256" "$4" ;;\n*.tar.gz) cp "$SPECTRA_E2E_ARCHIVE" "$4" ;;\n*) exit 73 ;;\nesac\n`, { mode: 0o755 });
    const env = { PATH: `${transport}:/usr/bin:/bin`, SPECTRA_VERSION: "v3.1.3", SPECTRA_HOME: path.join(dir, "custom home"), SPECTRA_BIN: path.join(dir, "shared bin"), SPECTRA_E2E_ARCHIVE: archive, SPECTRA_E2E_INSTALLER: path.join(repo, "install.sh") };
    const install = extra => run("sh", [path.join(repo, "install.sh")], { ...env, ...extra });
    const command = path.join(env.SPECTRA_BIN, "spectra");
    const editedArchive = edit => {
      const extracted = path.join(dir, `extract-${entry.commands.length}`); fs.mkdirSync(extracted);
      assert.equal(run("tar", ["-xzf", archive, "-C", extracted]).status, 0); edit(extracted);
      const file = path.join(dir, `edited-${entry.commands.length}.tar.gz`);
      assert.equal(run("tar", ["-czf", file, "-C", extracted, "."]).status, 0);
      fs.writeFileSync(file + ".sha256", `${hash(file)}  ${asset}\n`); return file;
    };
    try { action({ dir, entry, run, env, install, command, editedArchive }); entry.passed = true; }
    catch (error) { entry.error = error.message; throw error; }
    finally { entry.finalInventory = inventory(dir); save(); t.diagnostic(`Native artifact: ${root}/results.json`); }
  });
}
const success = result => assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
const rejected = result => assert.equal(result.status, 1, result.stderr || result.stdout);
function stagedOlderArchive({ dir, run, editedArchive }) {
  // This is an explicitly staged build of current code with test version 3.1.2,
  // not a claim about behavior of a published historical 3.1.2 executable.
  const fixture = path.join(dir, "fixture"); fs.mkdirSync(fixture);
  const bundle = fs.readFileSync(path.join(repo, "packages/cli/dist/native/build/spectra.cjs"), "utf8");
  assert(bundle.includes('CLI_VERSION = "3.1.3"'));
  fs.writeFileSync(path.join(fixture, "spectra.cjs"), bundle.replace('CLI_VERSION = "3.1.3"', 'CLI_VERSION = "3.1.2"'));
  const node = process.env.SPECTRA_NATIVE_NODE || (fs.existsSync("/private/tmp/spectra-native-node/node_modules/node/bin/node") ? "/private/tmp/spectra-native-node/node_modules/node/bin/node" : process.execPath);
  const binary = path.join(fixture, "spectra"); const blob = path.join(fixture, "sea.blob");
  const config = path.join(fixture, "sea.json");
  fs.writeFileSync(config, JSON.stringify({ main: path.join(fixture, "spectra.cjs"), output: blob, disableExperimentalSEAWarning: true }));
  success(run(node, ["--experimental-sea-config", config])); fs.copyFileSync(node, binary); fs.chmodSync(binary, 0o755);
  if (process.platform === "darwin") run("codesign", ["--remove-signature", binary]);
  success(run(path.join(repo, "node_modules/.bin/postject"), [binary, "NODE_SEA_BLOB", blob, "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2", ...(process.platform === "darwin" ? ["--macho-segment-name", "NODE_SEA"] : [])]));
  if (process.platform === "darwin") success(run("codesign", ["--force", "--sign", "-", binary]));
  const older = editedArchive(extracted => { fs.copyFileSync(binary, path.join(extracted, "bin/spectra")); fs.writeFileSync(path.join(extracted, "VERSION"), "3.1.2\n"); const manifest = path.join(extracted, "assets/runtime/sdd/system/manifest.env"); fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace("spectra_version=3.1.3", "spectra_version=3.1.2")); });
  return older;
}
scenario("bad checksum never creates machine roots", ({ dir, env, install }) => {
  const bad = path.join(dir, asset); fs.copyFileSync(archive, bad); fs.writeFileSync(bad + ".sha256", `${"0".repeat(64)}  ${asset}\n`);
  rejected(install({ SPECTRA_E2E_ARCHIVE: bad })); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
for (const version of ["../outside", "3.1.3/../../outside", "3.1.3\n../outside", "3.1.3garbage", "v3.1.3"]) scenario(`invalid VERSION ${JSON.stringify(version)}`, ({ env, install, editedArchive }) => {
  const bad = editedArchive(extracted => fs.writeFileSync(path.join(extracted, "VERSION"), version + "\n"));
  rejected(install({ SPECTRA_E2E_ARCHIVE: bad })); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("foreign command is preserved", ({ env, install, command }) => {
  fs.mkdirSync(env.SPECTRA_BIN); fs.writeFileSync(command, "foreign\n", { mode: 0o755 }); const before = inventory(env.SPECTRA_BIN);
  rejected(install()); assert.deepEqual(inventory(env.SPECTRA_BIN), before); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("foreign version is preserved", ({ env, install }) => {
  fs.mkdirSync(path.join(env.SPECTRA_HOME, "3.1.3"), { recursive: true }); fs.writeFileSync(path.join(env.SPECTRA_HOME, "3.1.3/user.txt"), "valuable\n");
  const before = inventory(env.SPECTRA_HOME); rejected(install()); assert.deepEqual(inventory(env.SPECTRA_HOME), before);
});
scenario("symlink root is preserved", ({ dir, env, install }) => {
  const foreign = path.join(dir, "foreign"); fs.mkdirSync(foreign); fs.writeFileSync(path.join(foreign, "user.txt"), "valuable\n");
  fs.symlinkSync(foreign, env.SPECTRA_HOME); const before = inventory(foreign); rejected(install()); assert.deepEqual(inventory(foreign), before);
});
scenario("custom paths and same-version reinstall retain owned activation and shared files", ({ env, install, command, run }) => {
  success(install()); const target = fs.realpathSync(command); const before = inventory(env.SPECTRA_HOME);
  fs.writeFileSync(path.join(env.SPECTRA_BIN, "other"), "shared\n"); success(install());
  assert.equal(fs.realpathSync(command), target); assert.deepEqual(inventory(env.SPECTRA_HOME), before);
  assert.equal(fs.readFileSync(path.join(env.SPECTRA_BIN, "other"), "utf8"), "shared\n");
  assert(fs.existsSync(path.join(env.SPECTRA_HOME, "installation.env"))); assert(fs.existsSync(path.join(env.SPECTRA_HOME, "3.1.3/ownership.env")));
  assert.notEqual(run("sh", ["-c", "command -v node"], env).status, 0, "Native smoke PATH must exclude Node"); assert.match(run(command, ["version"], env).stdout, /3\.1\.3/);
});
scenario("uninstall revalidates a stable command changed after planning", ({ dir, env, install, command, run }) => {
  success(install());
  const foreign = path.join(dir, "foreign-command"); fs.writeFileSync(foreign, "foreign command\n");
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); fs.unlinkSync(plan.commandPath); fs.symlinkSync(process.env.SPECTRA_FOREIGN,plan.commandPath); const result=api.executeApplicationUninstall(plan); const afterFirst={result,versionExists:fs.existsSync(path.join(plan.home,machine.currentVersion)),machineRecord:fs.existsSync(path.join(plan.home,"installation.env"))}; fs.unlinkSync(plan.commandPath); fs.symlinkSync(plan.commandTarget,plan.commandPath); const retry=api.executeApplicationUninstall(api.planApplicationUninstall({...api.readMachineInstallation(plan.home),kind:"native-managed"})); console.log(JSON.stringify({afterFirst,retry}));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], { ...env, SPECTRA_FOREIGN: foreign }); success(result);
  const state = JSON.parse(result.stdout); assert(fs.existsSync(foreign));
  assert.equal(state.afterFirst.versionExists, true); assert.equal(state.afterFirst.machineRecord, true);
  assert(state.afterFirst.result.preserved.includes(command));
  assert(state.retry.removed.includes(command)); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("uninstall preserves a version-root symlink introduced after planning", ({ dir, env, install, command, run }) => {
  success(install());
  const active = path.join(env.SPECTRA_HOME, "3.1.3"), saved = path.join(dir, "saved-owned-runtime"), foreign = path.join(dir, "foreign-version");
  fs.mkdirSync(foreign); fs.writeFileSync(path.join(foreign, "keep.txt"), "foreign\n");
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); fs.renameSync(process.env.SPECTRA_ACTIVE,process.env.SPECTRA_SAVED); fs.symlinkSync(process.env.SPECTRA_FOREIGN,process.env.SPECTRA_ACTIVE,"dir"); const result=api.executeApplicationUninstall(plan); console.log(JSON.stringify(result));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], { ...env, SPECTRA_ACTIVE: active, SPECTRA_SAVED: saved, SPECTRA_FOREIGN: foreign }); success(result);
  assert.equal(fs.readlinkSync(command), path.join(active, "bin/spectra"));
  assert.equal(fs.lstatSync(active).isSymbolicLink(), true); assert.equal(fs.readFileSync(path.join(foreign, "keep.txt"), "utf8"), "foreign\n");
  assert(fs.existsSync(path.join(env.SPECTRA_HOME, "installation.env"))); assert(fs.existsSync(saved));
});
scenario("uninstall preserves unexpected nested runtime files", ({ env, install, command, run }) => {
  success(install());
  const userFile = path.join(env.SPECTRA_HOME, "3.1.3/assets/runtime/user-notes.txt"); fs.writeFileSync(userFile, "keep this\n");
  const result = run(command, ["uninstall", "--yes"], env); rejected(result);
  assert.match(result.stdout + result.stderr, /Preserved .*3\.1\.3/);
  assert.equal(fs.readFileSync(userFile, "utf8"), "keep this\n");
  assert.equal(fs.existsSync(command), true); assert.equal(fs.existsSync(path.join(env.SPECTRA_HOME, "installation.env")), true);
});
scenario("uninstall resumes after an injected partial active-tree deletion", ({ env, install, command, run }) => {
  success(install());
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const unlink=fs.unlinkSync; let failed=false; fs.unlinkSync=(target)=>{ if (!failed && String(target).includes("/assets/runtime/")) { failed=true; unlink(target); throw new Error("injected partial unlink"); } return unlink(target); }; const first=api.executeApplicationUninstall(plan); fs.unlinkSync=unlink; const pending=fs.existsSync(path.join(plan.home,"uninstall.pending.json")); const stable=fs.readlinkSync(plan.commandPath); console.log(JSON.stringify({first,pending,stable}));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], env); success(result);
  const state = JSON.parse(result.stdout); assert.equal(state.pending, true); assert.equal(state.stable, path.join(env.SPECTRA_HOME, "3.1.3/bin/spectra"));
  assert(state.first.preserved.length > 0); success(run(command, ["uninstall", "--yes"], env)); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("uninstall resumes after an active file removal fails before changing bytes", ({ env, install, command, run }) => {
  success(install());
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const unlink=fs.unlinkSync; let failed=false; fs.unlinkSync=(target)=>{ if (!failed && String(target).includes("/assets/runtime/")) { failed=true; throw new Error("injected removal failure"); } return unlink(target); }; const result=api.executeApplicationUninstall(plan); fs.unlinkSync=unlink; console.log(JSON.stringify({result,link:fs.readlinkSync(plan.commandPath),version:fs.existsSync(path.join(plan.home,machine.currentVersion))}));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], env); success(result);
  const state = JSON.parse(result.stdout); assert.equal(state.link, path.join(env.SPECTRA_HOME, "3.1.3/bin/spectra")); assert.equal(state.version, true);
  assert(state.result.preserved.includes(path.join(env.SPECTRA_HOME, "3.1.3"))); assert.match(run(command, ["version"], env).stdout, /3\.1\.3/);
  const retry = run(command, ["uninstall", "--yes"], env); success(retry); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("uninstall can be resumed directly after the stable command is removed", ({ env, install, command, run }) => {
  success(install());
  const activeExecutable = path.join(env.SPECTRA_HOME, "3.1.3/bin/spectra");
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const unlink=fs.unlinkSync; let failed=false; fs.unlinkSync=(target)=>{ if (!failed && String(target).endsWith("/install.sh")) { failed=true; unlink(target); throw new Error("injected final-stage interruption"); } return unlink(target); }; const result=api.executeApplicationUninstall(plan); fs.unlinkSync=unlink; console.log(JSON.stringify({result,command:fs.existsSync(plan.commandPath),executable:fs.existsSync(plan.commandTarget),pending:fs.existsSync(path.join(plan.home,"uninstall.pending.json"))}));`;
  const first = run(process.execPath, ["--input-type=module", "-e", script], env); success(first);
  const state = JSON.parse(first.stdout); assert.equal(state.command, false); assert.equal(state.executable, true); assert.equal(state.pending, true);
  success(run(activeExecutable, ["uninstall", "--yes"], env)); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("uninstall rejects traversal in a pending ownership snapshot", ({ dir, env, install, run }) => {
  success(install());
  const victim = path.join(dir, "victim.txt"); fs.writeFileSync(victim, "valuable\n");
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const digest = hash(victim);
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const unlink=fs.unlinkSync; fs.unlinkSync=(target)=>{ if (String(target).includes("/assets/runtime/")) throw new Error("injected stop"); return unlink(target); }; api.executeApplicationUninstall(plan); fs.unlinkSync=unlink; const markerPath=path.join(plan.home,"uninstall.pending.json"); const marker=JSON.parse(fs.readFileSync(markerPath,"utf8")); marker.plan.versions[0].tree.push(["../../victim.txt",0o600,process.env.SPECTRA_VICTIM_HASH]); fs.writeFileSync(markerPath,JSON.stringify(marker)+"\\n"); const inspected=api.inspectApplicationInstallation({execPath:plan.commandTarget}); let rejected=false; try { api.executeApplicationUninstall(plan); } catch { rejected=true; } console.log(JSON.stringify({kind:inspected.kind,rejected,victim:fs.readFileSync(process.env.SPECTRA_VICTIM,"utf8")}));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], { ...env, SPECTRA_VICTIM: victim, SPECTRA_VICTIM_HASH: digest }); success(result);
  const state = JSON.parse(result.stdout); assert.equal(state.kind, "unmanaged"); assert.equal(state.rejected, true); assert.equal(state.victim, "valuable\n");
});
scenario("uninstall keeps pending recovery when a retained version cannot be removed", ({ dir, env, install, command, run, editedArchive }) => {
  success(install()); const older = stagedOlderArchive({ dir, run, editedArchive }); success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const active = path.join(env.SPECTRA_HOME, "3.1.2/bin/spectra"), retained = path.join(env.SPECTRA_HOME, "3.1.3");
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const rm=fs.rmSync; let failed=false; fs.rmSync=(target,options)=>{ if (!failed && String(target).includes(".3.1.3.uninstall-")) { failed=true; throw new Error("injected retained removal failure"); } return rm(target,options); }; const first=api.executeApplicationUninstall(plan); fs.rmSync=rm; const pending=fs.existsSync(path.join(plan.home,"uninstall.pending.json")); const retry=api.executeApplicationUninstall(api.planApplicationUninstall(api.inspectApplicationInstallation({execPath:process.env.SPECTRA_ACTIVE}))); console.log(JSON.stringify({first,pending,retry}));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], { ...env, SPECTRA_ACTIVE: active }); success(result);
  const state = JSON.parse(result.stdout); assert.equal(state.pending, true); assert(state.first.preserved.includes(retained));
  assert(state.retry.removed.includes(command)); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("uninstall reports a partially removed retained version for manual recovery", ({ dir, env, install, command, run, editedArchive }) => {
  success(install()); const older = stagedOlderArchive({ dir, run, editedArchive }); success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const rm=fs.rmSync; let failed=false; fs.rmSync=(target,options)=>{ if (!failed && String(target).includes(".3.1.3.uninstall-")) { failed=true; fs.unlinkSync(path.join(target,"LICENSE")); throw new Error("injected partial retained deletion"); } return rm(target,options); }; const result=api.executeApplicationUninstall(plan); fs.rmSync=rm; console.log(JSON.stringify({result,pending:JSON.parse(fs.readFileSync(path.join(plan.home,"uninstall.pending.json"),"utf8")).plan.manualRecovery,command:fs.readlinkSync(plan.commandPath)}));`;
  const first = run(process.execPath, ["--input-type=module", "-e", script], env); success(first);
  const state = JSON.parse(first.stdout), recovery = state.pending[0].path;
  assert.equal(state.command, path.join(env.SPECTRA_HOME, "3.1.2/bin/spectra")); assert(fs.existsSync(recovery)); assert(state.result.preserved.includes(recovery)); assert.deepEqual(state.result.manualRecovery, [recovery]);
  const blocked = run(command, ["uninstall", "--yes"], env); rejected(blocked); assert.match(blocked.stdout + blocked.stderr, /partial owned runtime/); assert((blocked.stdout + blocked.stderr).includes(recovery));
  fs.rmSync(recovery, { recursive: true }); success(run(command, ["uninstall", "--yes"], env)); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
});
scenario("uninstall does not delete a retained-version replacement installed after validation", ({ dir, env, install, command, run, editedArchive }) => {
  success(install());
  const older = stagedOlderArchive({ dir, run, editedArchive }); success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const retained = path.join(env.SPECTRA_HOME, "3.1.3"), foreign = path.join(dir, "foreign-after-validation"); fs.mkdirSync(foreign); fs.writeFileSync(path.join(foreign, "keep.txt"), "foreign\n");
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const rm=fs.rmSync; let swapped=false; fs.rmSync=(target,options)=>{ if (!swapped && String(target).includes(".3.1.3.uninstall-")) { swapped=true; fs.symlinkSync(process.env.SPECTRA_FOREIGN,process.env.SPECTRA_RETAINED,"dir"); } return rm(target,options); }; const result=api.executeApplicationUninstall(plan); fs.rmSync=rm; console.log(JSON.stringify(result));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], { ...env, SPECTRA_FOREIGN: foreign, SPECTRA_RETAINED: retained }); success(result);
  const state = JSON.parse(result.stdout); assert.equal(fs.readFileSync(path.join(foreign, "keep.txt"), "utf8"), "foreign\n");
  assert.equal(fs.lstatSync(retained).isSymbolicLink(), true); assert.equal(fs.readlinkSync(retained), foreign);
  assert(state.preserved.includes(retained)); assert.equal(fs.existsSync(command), false); assert.equal(fs.existsSync(path.join(env.SPECTRA_HOME, "installation.env")), false);
});
scenario("uninstall supports installer default HOME roots and leaves shared parents", ({ dir, env, install, run }) => {
  const userHome = path.join(dir, "default home");
  success(install({ HOME: userHome, SPECTRA_HOME: "", SPECTRA_BIN: "" }));
  const home = path.join(userHome, ".local/share/spectra"), command = path.join(userHome, ".local/bin/spectra");
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.HOME+"/.local/share/spectra"); const result=api.executeApplicationUninstall(api.planApplicationUninstall({...machine,kind:"native-managed"})); console.log(JSON.stringify(result));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], { HOME: userHome, SPECTRA_HOME: "" }); success(result);
  assert.equal(fs.existsSync(home), false); assert.equal(fs.existsSync(command), false);
  assert(fs.existsSync(path.join(userHome, ".local/share")));
  assert(fs.existsSync(path.join(userHome, ".local/bin")));
});
scenario("uninstall removes verified versions while preserving unrelated machine and project data", ({ dir, env, install, command, run, editedArchive }) => {
  success(install());
  const oldArchive = stagedOlderArchive({ dir, run, editedArchive });
  success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: oldArchive }));
  const unrelated = path.join(env.SPECTRA_HOME, "user-data"); fs.mkdirSync(unrelated); fs.writeFileSync(path.join(unrelated, "keep.txt"), "keep\n");
  const shared = path.join(env.SPECTRA_BIN, "other-command"); fs.writeFileSync(shared, "keep\n");
  const projects = ["project-a", "project-b"].map(name => {
    const root = path.join(dir, name); fs.mkdirSync(path.join(root, ".git/info"), { recursive: true });
    fs.writeFileSync(path.join(root, "README.md"), `${name}\n`); fs.writeFileSync(path.join(root, ".git/info/exclude"), "/.spectra/\n");
    return root;
  });
  const before = projects.map(inventory);
  const api = pathToFileURL(path.join(repo, "packages/cli/src/lib/application-installation.js")).href;
  const script = `import fs from "node:fs"; import * as api from ${JSON.stringify(api)}; const machine=api.readMachineInstallation(process.env.SPECTRA_HOME); const plan=api.planApplicationUninstall({...machine,kind:"native-managed"}); const result=api.executeApplicationUninstall(plan); console.log(JSON.stringify({result,versions:plan.versions.map(item=>fs.existsSync(item.directory))}));`;
  const result = run(process.execPath, ["--input-type=module", "-e", script], env); success(result);
  const state = JSON.parse(result.stdout);
  assert.deepEqual(state.versions, [false, false]); assert.equal(fs.existsSync(command), false);
  assert.equal(fs.existsSync(path.join(env.SPECTRA_HOME, "installation.env")), false);
  assert.equal(fs.readFileSync(path.join(unrelated, "keep.txt"), "utf8"), "keep\n");
  assert.equal(fs.readFileSync(shared, "utf8"), "keep\n");
  assert(state.result.preserved.includes(unrelated));
  assert.deepEqual(projects.map(inventory), before);
});
scenario("failed smoke retains prior activation and rejects replacement", ({ env, install, command, editedArchive }) => {
  success(install()); const before = inventory(env.SPECTRA_HOME); const target = fs.readlinkSync(command);
  const bad = editedArchive(extracted => fs.writeFileSync(path.join(extracted, "bin/spectra"), "#!/bin/sh\nexit 71\n", { mode: 0o755 }));
  rejected(install({ SPECTRA_E2E_ARCHIVE: bad })); assert.deepEqual(inventory(env.SPECTRA_HOME), before); assert.equal(fs.readlinkSync(command), target);
});
scenario("missing runtime and symlink archive cannot activate", ({ env, install, editedArchive }) => {
  for (const edit of [extracted => fs.rmSync(path.join(extracted, "assets"), { recursive: true }), extracted => { fs.unlinkSync(path.join(extracted, "VERSION")); fs.symlinkSync("/etc/passwd", path.join(extracted, "VERSION")); }]) {
    const bad = editedArchive(edit); rejected(install({ SPECTRA_E2E_ARCHIVE: bad })); assert.equal(fs.existsSync(env.SPECTRA_HOME), false);
  }
});
scenario("version mismatch retains prior activation", ({ env, install, command, editedArchive }) => {
  success(install()); const before = inventory(env.SPECTRA_HOME); const target = fs.readlinkSync(command);
  const bad = editedArchive(extracted => fs.writeFileSync(path.join(extracted, "VERSION"), "3.1.4\n"));
  rejected(install({ SPECTRA_VERSION: "v3.1.4", SPECTRA_E2E_ARCHIVE: bad })); assert.deepEqual(inventory(env.SPECTRA_HOME), before); assert.equal(fs.readlinkSync(command), target);
});
scenario("interrupted stage and failed activation retain previous bytes", ({ env, install, command, dir }) => {
  success(install()); const before = inventory(env.SPECTRA_HOME); const target = fs.readlinkSync(command);
  const transport = env.PATH.split(":")[0]; const realTar = spawnSync("sh", ["-c", "command -v tar"], { encoding: "utf8" }).stdout.trim();
  fs.writeFileSync(path.join(transport, "tar"), `#!/bin/sh\ncase "$1" in -xzf) exit 74 ;; esac\nexec ${quote(realTar)} "$@"\n`, { mode: 0o755 });
  assert.notEqual(install().status, 0); assert.deepEqual(inventory(env.SPECTRA_HOME), before); assert.equal(fs.readlinkSync(command), target);
  fs.unlinkSync(path.join(transport, "tar")); fs.writeFileSync(path.join(transport, "ln"), "#!/bin/sh\nexit 75\n", { mode: 0o755 });
  assert.notEqual(install().status, 0); assert.deepEqual(inventory(env.SPECTRA_HOME), before); assert.equal(fs.readlinkSync(command), target); assert.equal(fs.existsSync(path.join(dir, "outside")), false);
});
scenario("native provenance refuses spoofed roots and source invocation", ({ install, env, command, run }) => {
  success(install()); const before = inventory(env.SPECTRA_HOME);
  const result = run(process.execPath, [path.join(repo, "packages/cli/bin/spectra.js"), "update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "99.0.0" });
  rejected(result); assert.match(result.stderr + result.stdout, /install|package.manager/i); assert.deepEqual(inventory(env.SPECTRA_HOME), before);
  const native = run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.4" }); rejected(native);
  assert.match(native.stderr + native.stdout, /version|3\.1\.4|mismatch/i); assert.deepEqual(inventory(env.SPECTRA_HOME), before);
});
scenario("managed native update retains prior version and two independent projects", ({ dir, env, run, install, command, editedArchive }) => {
  const older = stagedOlderArchive({ dir, run, editedArchive });
  success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const previousDir = path.join(env.SPECTRA_HOME, "3.1.2");
  const previous = inventory(previousDir); const previousBytes = hash(path.join(previousDir, "bin/spectra"));
  const projects = ["project-a", "project-b"].map(name => path.join(dir, name));
  for (const project of projects) { fs.mkdirSync(project); success(run("git", ["init", "-q", project])); success(run(command, ["init", project], env)); }
  const before = projects.map(inventory);
  success(run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" }));
  assert.equal(fs.realpathSync(command), path.join(env.SPECTRA_HOME, "3.1.3/bin/spectra"));
  assert.match(run(command, ["version"], env).stdout, /3\.1\.3/);
  const retained = inventory(previousDir);
  for (const file of ["bin/spectra", "bin/spectra.rollback", "ownership.env"]) { delete retained[file]; delete previous[file]; }
  assert.deepEqual(retained, previous, "Forwarding may change only executable ownership files");
  assert.equal(hash(path.join(previousDir, "bin/spectra.rollback")), previousBytes);
  assert.match(fs.readFileSync(path.join(previousDir, "ownership.env"), "utf8"), /^forwarderSha256=/m);
  assert.deepEqual(projects.map(inventory), before);
  assert(fs.existsSync(path.join(env.SPECTRA_HOME, "3.1.2/ownership.env")));
});

scenario("old native project launcher follows the stable command after machine update", ({ dir, env, run, install, command, editedArchive }) => {
  const older = stagedOlderArchive({ dir, run, editedArchive });
  success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const project = path.join(dir, "old-launcher-project"); fs.mkdirSync(project);
  success(run("git", ["init", "-q", project])); success(run(command, ["init", project], env));
  const launcher = path.join(project, ".spectra/bin/spectra");
  const legacyBinary = path.join(env.SPECTRA_HOME, "3.1.2/bin/spectra");
  fs.writeFileSync(launcher, [
    "#!/usr/bin/env sh", "set -eu", "RECORDED_BINARY=" + quote(legacyBinary),
    "if [ -x \"$RECORDED_BINARY\" ]; then exec \"$RECORDED_BINARY\" \"$@\"; fi",
    "exit 127", ""
  ].join("\n"), { mode: 0o755 });
  assert.match(run(launcher, ["version"], env).stdout, /3\.1\.2/);
  const projectBefore = inventory(project); const oldExecutable = legacyBinary;
  const oldBytes = hash(oldExecutable);
  success(run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" }));
  assert.match(run(launcher, ["version"], { ...env, PATH: "/usr/bin:/bin" }).stdout, /3\.1\.3/);
  assert.match(run(oldExecutable, ["version"], { ...env, PATH: "/usr/bin:/bin" }).stdout, /3\.1\.3/);
  assert.equal(hash(path.join(env.SPECTRA_HOME, "3.1.2/bin/spectra.rollback")), oldBytes, "Forwarding must preserve original executable bytes for rollback");
  assert.deepEqual(inventory(project), projectBefore, "Machine update must not visit project directories");
});

scenario("update retries an interrupted forwarding backup only when it matches the owned executable", ({ dir, env, run, install, command, editedArchive }) => {
  const older = stagedOlderArchive({ dir, run, editedArchive });
  success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const oldExecutable = path.join(env.SPECTRA_HOME, "3.1.2/bin/spectra");
  const oldBytes = hash(oldExecutable);
  fs.copyFileSync(oldExecutable, oldExecutable + ".rollback", fs.constants.COPYFILE_EXCL);
  assert.equal(hash(oldExecutable + ".rollback"), oldBytes, "Simulates a crash after preserving bytes, before replacing the executable");
  success(run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" }));
  assert.equal(hash(oldExecutable + ".rollback"), oldBytes, "Successful retry must retain the rollback copy");
  assert.match(fs.readFileSync(path.join(env.SPECTRA_HOME, "3.1.2/ownership.env"), "utf8"), /^forwarderSha256=/m);
  assert.match(run(oldExecutable, ["version"], { ...env, PATH: "/usr/bin:/bin" }).stdout, /3\.1\.3/);
});

scenario("update completes a committed forwarder marker after activation but before executable replacement", ({ dir, env, run, install, command, editedArchive }) => {
  const older = stagedOlderArchive({ dir, run, editedArchive });
  success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const oldExecutable = path.join(env.SPECTRA_HOME, "3.1.2/bin/spectra");
  success(run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" }));
  const originalBytes = fs.readFileSync(oldExecutable + ".rollback");
  const forwarder = "#!/bin/sh\nexec " + quote(command) + " \"$@\"\n";
  const recordPath = path.join(env.SPECTRA_HOME, "3.1.2/ownership.env");
  const validRecord = fs.readFileSync(recordPath, "utf8");
  assert.match(validRecord, /^forwarderSha256=/m);
  fs.writeFileSync(oldExecutable + ".pending", originalBytes, { mode: 0o755 });
  fs.renameSync(oldExecutable + ".pending", oldExecutable);
  const pendingMachine = readMachineInstallation(env.SPECTRA_HOME);
  assert.equal(pendingMachine.versions.find(version => version.version === "3.1.2")?.forwardingPending, true);
  const retry = run(oldExecutable, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" });
  success(retry);
  assert.equal(fs.readFileSync(oldExecutable, "utf8") === forwarder, true, "Retry should replace the retained executable from its committed marker");
  assert.deepEqual(fs.readFileSync(oldExecutable + ".rollback"), originalBytes, "Retry should preserve the exact original executable bytes");
  assert.equal(fs.realpathSync(command), path.join(env.SPECTRA_HOME, "3.1.3/bin/spectra"));
  fs.writeFileSync(oldExecutable + ".mismatch", "foreign executable\n", { mode: 0o755 });
  fs.renameSync(oldExecutable + ".mismatch", oldExecutable);
  const mismatchedInventory = inventory(env.SPECTRA_HOME);
  assert(mismatchedInventory && readMachineInstallation(env.SPECTRA_HOME).preserved.includes(path.join(env.SPECTRA_HOME, "3.1.2")), "Mismatched retained bytes must be treated as unowned and preserved");
  const mismatchResult = run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" });
  success(mismatchResult);
  assert.deepEqual(inventory(env.SPECTRA_HOME), mismatchedInventory, "Mismatched retained executable must remain preserved and untouched");

  fs.writeFileSync(oldExecutable + ".restore", originalBytes, { mode: 0o755 });
  fs.renameSync(oldExecutable + ".restore", oldExecutable);
  fs.writeFileSync(recordPath, validRecord.replace(/^forwarderSha256=.*$/m, "forwarderSha256="));
  const emptyMarkerInventory = inventory(env.SPECTRA_HOME);
  const emptyMarkerMachine = readMachineInstallation(env.SPECTRA_HOME);
  assert(emptyMarkerMachine.preserved.includes(path.join(env.SPECTRA_HOME, "3.1.2")), "An empty present forwarder marker must not be treated as an unforwarded ownership record");
  const emptyMarkerUpdate = run(oldExecutable, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" });
  rejected(emptyMarkerUpdate);
  assert.deepEqual(inventory(env.SPECTRA_HOME), emptyMarkerInventory, "Malformed marker must fail closed without changing machine files");

  fs.writeFileSync(recordPath, validRecord);
  const foreignRollback = path.join(dir, "foreign-rollback"); fs.writeFileSync(foreignRollback, originalBytes);
  fs.unlinkSync(oldExecutable + ".rollback"); fs.symlinkSync(foreignRollback, oldExecutable + ".rollback");
  const symlinkRollbackMachine = readMachineInstallation(env.SPECTRA_HOME);
  assert(symlinkRollbackMachine.preserved.includes(path.join(env.SPECTRA_HOME, "3.1.2")), "A symlink rollback must remain outside the owned set");
  assert.deepEqual(fs.readFileSync(foreignRollback), originalBytes, "Validation must not mutate the symlink target");
});

scenario("recorded custom stable command works when it is absent from PATH", ({ dir, env, install, command, run }) => {
  success(install());
  const project = path.join(dir, "custom-command-project"); fs.mkdirSync(project);
  success(run("git", ["init", "-q", project])); success(run(command, ["init", project], env));
  const metadataPath = path.join(project, ".spectra/install.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  assert.equal(metadata.stableCommandPath, command);
  assert.match(fs.readFileSync(path.join(project, ".spectra/bin/spectra"), "utf8"), /RECORDED_STABLE_COMMAND/);
  delete metadata.binaryPath;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  const result = run(path.join(project, ".spectra/bin/spectra"), ["version"], { ...env, PATH: "/usr/bin:/bin" });
  assert.match(result.stdout, /3\.1\.3/);
});

scenario("recordless executing native adoption updates safely and preserves projects", ({ dir, env, run, install, command, editedArchive }) => {
  const older = stagedOlderArchive({ dir, run, editedArchive });
  success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const oldDir = path.join(env.SPECTRA_HOME, "3.1.2");
  fs.unlinkSync(path.join(oldDir, "ownership.env")); fs.unlinkSync(path.join(env.SPECTRA_HOME, "installation.env")); fs.unlinkSync(path.join(oldDir, "install.sh"));
  const projects = ["legacy-a", "legacy-b"].map(name => path.join(dir, name));
  for (const project of projects) { fs.mkdirSync(project); success(run("git", ["init", "-q", project])); success(run(command, ["init", project], env)); }
  const projectBefore = projects.map(inventory); const legacyBefore = inventory(oldDir);
  rejected(run(process.execPath, [path.join(repo, "packages/cli/bin/spectra.js"), "update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "99.0.0" }));
  assert.deepEqual(inventory(oldDir), legacyBefore, "Source invocation cannot adopt a recordless native install");
  success(run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" }));
  assert.equal(fs.realpathSync(command), path.join(env.SPECTRA_HOME, "3.1.3/bin/spectra"));
  const legacyAfter = inventory(oldDir);
  for (const [name, digest] of Object.entries(legacyBefore)) if (name !== "bin/spectra") assert.deepEqual(legacyAfter[name], digest, name);
  assert.equal(hash(path.join(oldDir, "bin/spectra.rollback")), legacyBefore["bin/spectra"]);
  assert.match(fs.readFileSync(path.join(oldDir, "ownership.env"), "utf8"), /^forwarderSha256=/m);
  assert.match(fs.readFileSync(path.join(oldDir, "ownership.env"), "utf8"), /^method=native-legacy$/m);
  assert.match(fs.readFileSync(path.join(oldDir, "ownership.env"), "utf8"), /^archiveSha256=unknown$/m);
  assert.deepEqual(projects.map(inventory), projectBefore);
});
scenario("recordless native lookalikes and unexpected contents require a safe transition", ({ env, run, install, command }) => {
  success(install()); const versionDir = path.join(env.SPECTRA_HOME, "3.1.3");
  fs.unlinkSync(path.join(versionDir, "ownership.env")); fs.unlinkSync(path.join(env.SPECTRA_HOME, "installation.env")); fs.unlinkSync(path.join(versionDir, "install.sh"));
  const versionFile = path.join(versionDir, "VERSION");
  const manifest = path.join(versionDir, "assets/runtime/sdd/system/manifest.env");
  const originalManifest = fs.readFileSync(manifest, "utf8");
  const foreign = path.join(versionDir, "assets/runtime/user-memory.md");
  for (const invalid of ["VERSION", "runtime", "foreign", "partial-record"]) {
    if (invalid === "VERSION") fs.writeFileSync(versionFile, "3.1.2\n");
    if (invalid === "runtime") fs.unlinkSync(manifest);
    if (invalid === "foreign") fs.writeFileSync(foreign, "valuable user data\n");
    if (invalid === "partial-record") fs.writeFileSync(path.join(env.SPECTRA_HOME, "installation.env"), "unrecognized owner\n");
    const before = inventory(env.SPECTRA_HOME); const target = fs.readlinkSync(command);
    const result = run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.4" }); rejected(result);
    assert.match(result.stdout + result.stderr, /mktemp/);
    assert.match(result.stdout + result.stderr, /SPECTRA_HOME=/); assert.match(result.stdout + result.stderr, /SPECTRA_BIN=/); assert.match(result.stdout + result.stderr, /export PATH=/);
    assert.deepEqual(inventory(env.SPECTRA_HOME), before); assert.equal(fs.readlinkSync(command), target);
    fs.writeFileSync(versionFile, "3.1.3\n"); fs.writeFileSync(manifest, originalManifest);
    if (fs.existsSync(foreign)) fs.unlinkSync(foreign);
    const partial = path.join(env.SPECTRA_HOME, "installation.env"); if (fs.existsSync(partial)) fs.unlinkSync(partial);
  }
});

// Failure mode: interruption after the exact native-legacy version record is
// created but before the machine record must resume; partial/foreign records
// must remain protected. The real staged SEA supplies execution/runtime proof.
scenario("interrupted legacy adoption resumes only exact version ownership", ({ dir, env, run, install, command, editedArchive }) => {
  const older = stagedOlderArchive({ dir, run, editedArchive });
  success(install({ SPECTRA_VERSION: "v3.1.2", SPECTRA_E2E_ARCHIVE: older }));
  const oldDir = path.join(env.SPECTRA_HOME, "3.1.2");
  const ownership = path.join(oldDir, "ownership.env");
  const record = fs.readFileSync(ownership, "utf8").replace("method=native\n", "method=native-legacy\n").replace(/^archiveSha256=.*$/m, "archiveSha256=unknown");
  fs.unlinkSync(path.join(env.SPECTRA_HOME, "installation.env"));
  const projects = ["interrupted-a", "interrupted-b"].map(name => path.join(dir, name));
  for (const project of projects) { fs.mkdirSync(project); success(run("git", ["init", "-q", project])); success(run(command, ["init", project], env)); }
  const projectBefore = projects.map(inventory);
  for (const invalid of ["format=1\nmethod=native-legacy\n", record.replace(/^sha256=.*$/m, `sha256=${"0".repeat(64)}`)]) {
    fs.writeFileSync(ownership, invalid); const before = inventory(env.SPECTRA_HOME);
    rejected(run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" }));
    assert.deepEqual(inventory(env.SPECTRA_HOME), before);
    assert.equal(fs.readlinkSync(command), path.join(oldDir, "bin/spectra"));
    assert.deepEqual(projects.map(inventory), projectBefore);
  }
  fs.writeFileSync(ownership, record); const oldBefore = inventory(oldDir);
  success(run(command, ["update", "--yes"], { ...env, SPECTRA_LATEST_VERSION: "3.1.3" }));
  assert.equal(fs.realpathSync(command), path.join(env.SPECTRA_HOME, "3.1.3/bin/spectra"));
  const oldAfter = inventory(oldDir);
  for (const [name, digest] of Object.entries(oldBefore)) if (name !== "bin/spectra" && name !== "ownership.env") assert.deepEqual(oldAfter[name], digest, name);
  assert.equal(hash(path.join(oldDir, "bin/spectra.rollback")), oldBefore["bin/spectra"]);
  assert.equal(hash(path.join(oldDir, "install.sh")), oldBefore["install.sh"]);
  assert.match(fs.readFileSync(ownership, "utf8"), /^method=native-legacy$/m);
  assert.match(fs.readFileSync(ownership, "utf8"), /^archiveSha256=unknown$/m);
  assert.deepEqual(projects.map(inventory), projectBefore);
  assert(fs.existsSync(path.join(env.SPECTRA_HOME, "installation.env")));
});
