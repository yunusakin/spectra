// node tools/verify-release.mjs <version> <npm-tgz> <native-binary> <output-dir>
// Failure modes: version drift, missing packaged assets, broken launchers,
// adoption executes application tests, plugin guidance uses the wrong area,
// repeated repair/update overwrites project memory or plugin documents;
// installer accepts a bad checksum or writes outside its configured directories.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const [version, tgz, native, output] = process.argv.slice(2);
assert.equal(JSON.parse(fs.readFileSync("package.json", "utf8")).version, version, "Release version not prepared");
assert(tgz && native && output, "Provide version, npm archive, native binary and output directory");
assert(fs.statSync(native).isFile(), "Native executable must be a file");
const outputRoot = path.resolve(output);
fs.mkdirSync(outputRoot, { recursive: true });
const root = fs.mkdtempSync(path.join(outputRoot, "run-"));
const report = { version, commands: [], projects: [], passed: false };
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function run(command, args, cwd = root, env = {}, expectedExitCode = 0) {
  const result = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
  report.commands.push({ command, args, cwd, exitCode: result.status, expectedExitCode, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
  fs.writeFileSync(path.join(root, "results.json"), JSON.stringify(report, null, 2) + "\n");
  assert.equal(result.status, expectedExitCode, result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}
function inventory(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === ".git") return [];
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return inventory(absolute, relative);
    return [{ path: relative, sha256: hash(absolute) }];
  }).sort((a, b) => a.path.localeCompare(b.path));
}
try {
  // Freeze the supplied native artifact before any installer/test child runs.
  const expectedNativeHash = hash(path.resolve(native));
  const install = path.join(root, "npm-install");
  fs.mkdirSync(install, { recursive: true });
  run("npm", ["install", "--prefix", install, "--ignore-scripts", "--no-audit", "--no-fund", path.resolve(tgz)]);
  const npmBin = path.join(install, "node_modules/spectra-pack/bin/spectra.js");
  // Use the real installer with a local transport for the not-yet-published archive.
  const asset = `spectra-${process.platform}-${process.arch}.tar.gz`;
  const archive = path.resolve("packages/cli/dist/native", asset);
  const nativeArchive = path.resolve(native);
  assert.equal(hash(nativeArchive), hash(archive), "Provided native archive must match packaged release asset");
  const archiveExecutable = path.join(root, "bin/spectra");
  run("tar", ["-xzf", nativeArchive, "-C", root]);
  const nativeHash = hash(archiveExecutable);
  run("tar", ["-xzf", archive, "-C", root]);
  const transport = path.join(root, "transport");
  fs.mkdirSync(transport);
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  fs.writeFileSync(path.join(transport, "curl"), [
    "#!/bin/sh", "set -eu",
    'test "$1" = -fsSL; test "$3" = -o',
    'case "$2" in',
    `${quote(`https://github.com/yunusakin/spectra/releases/download/v${version}/${asset}`)}) cp ${quote(archive)} "$4" ;;`,
    `${quote(`https://github.com/yunusakin/spectra/releases/download/v${version}/${asset}.sha256`)}) cp ${quote(archive + ".sha256")} "$4" ;;`,
    '*) exit 2 ;;', "esac", ""
  ].join("\n"), { mode: 0o755 });
  const installerEnv = { PATH: `${transport}:/usr/bin:/bin`, SPECTRA_VERSION: `v${version}`, SPECTRA_HOME: path.join(root, "native-home"), SPECTRA_BIN: path.join(root, "native-bin") };
  run("sh", [path.resolve("install.sh")], root, installerEnv);
  const installedNative = path.join(installerEnv.SPECTRA_BIN, "spectra");
  assert.equal(hash(fs.realpathSync(installedNative)), nativeHash);
  const ownership = path.join(installerEnv.SPECTRA_HOME, version, "ownership.env");
  const machine = path.join(installerEnv.SPECTRA_HOME, "installation.env");
  assert(fs.readFileSync(machine, "utf8").includes(`commandPath=${installedNative}\n`));
  assert(fs.readFileSync(ownership, "utf8").includes(`installerSha256=${hash(path.join(installerEnv.SPECTRA_HOME, version, "install.sh"))}\n`));
  const nativeBeforeReinstall = inventory(installerEnv.SPECTRA_HOME);
  run("sh", [path.resolve("install.sh")], root, installerEnv);
  assert.deepEqual(inventory(installerEnv.SPECTRA_HOME), nativeBeforeReinstall, "Same-version reinstall must retain complete owned runtime");
  report.nativeInstallation = { commandPath: installedNative, home: installerEnv.SPECTRA_HOME, ownership: fs.readFileSync(ownership, "utf8"), machine: fs.readFileSync(machine, "utf8"), inventory: nativeBeforeReinstall };
  // Reuse the test-first real transport matrix for archive/path/ownership failures.
  run(process.execPath, ["--test", path.resolve("packages/cli/test/native-installation-e2e.test.js")], root, { SPECTRA_NATIVE_ARCHIVE: archive, SPECTRA_NATIVE_ARTIFACT_DIR: root });
  const modes = [
    { name: "npm", command: process.execPath, prefix: [npmBin], env: {} },
    { name: "native", command: installedNative, prefix: [], env: { PATH: "/usr/bin:/bin" } }
  ];
  const releaseProjects = [];
  for (const mode of modes) {
    if (mode.name === "native") assert.equal(spawnSync("sh", ["-c", "command -v node"], { env: { ...process.env, ...mode.env } }).status, 1, "Native smoke PATH must exclude Node");
    assert.match(run(mode.command, [...mode.prefix, "version"], root, mode.env), new RegExp(version.replaceAll(".", "\\.")));
    const project = path.join(root, `${mode.name}-acme`);
    releaseProjects.push(project);
    fs.mkdirSync(path.join(project, "src"), { recursive: true });
    fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "acme", private: true, scripts: { test: "touch TESTS_EXECUTED" } }));
    fs.writeFileSync(path.join(project, "src/app.js"), "export const app = true;\n");
    run("git", ["init", "-q"], project);
    run("git", ["add", "."], project);
    run("git", ["-c", "user.name=Release E2E", "-c", "user.email=release@example.test", "commit", "-qm", "Fixture"], project);
    const before = inventory(project);
    run(mode.command, [...mode.prefix, "adopt", project, "--git-mode", "local", "--agents", "claude"], root, mode.env);
    const launcher = path.join(project, ".spectra/bin/spectra");
    const invoke = args => run(launcher, args, project, mode.env);
    const metaFile = path.join(project, ".spectra/install.json");
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    assert.equal(meta.cliVersion, version); assert.equal(meta.runtimeVersion, version); assert.equal(meta.schemaVersion, 3);
    assert.equal(meta.stableCommandPath, mode.name === "native" ? installedNative : null);
    assert(meta.docsProjectName);
    const docs = `.spectra/docs/${meta.docsProjectName}`;
    assert(fs.readFileSync(path.join(project, "CLAUDE.md"), "utf8").includes(docs));
    assert(fs.readFileSync(path.join(project, ".spectra/docs/spectra/cli-reference.md"), "utf8").includes("## doctor"));
    assert(fs.readFileSync(path.join(project, ".spectra/sdd/memory-bank/discovery/testing.md"), "utf8").includes("touch TESTS_EXECUTED"));
    assert(!fs.existsSync(path.join(project, "TESTS_EXECUTED")), "Adopt must not execute the application's test command");
    assert.equal(run("git", ["status", "--porcelain"], project).trim(), "", "Local installation must stay excluded");
    invoke(["index", "--check"]); invoke(["check"]); invoke(["context", "--role", "planner", "--goal", "discover"]);
    const brief = path.join(project, ".spectra/sdd/memory-bank/core/projectbrief.md");
    const plugin = path.join(project, docs, "superpowers/plan.md");
    fs.mkdirSync(path.dirname(plugin), { recursive: true });
    fs.writeFileSync(plugin, "# User plugin plan\nKeep this document.\n");
    fs.writeFileSync(brief, "# Project Brief\n\n## Project Name\nRenamed Acme\n\n## Purpose\nPreserve user intent.\n");
    // A meaningful brief activates project-memory policy: complete its companion templates.
    for (const name of ["activeContext.md", "progress.md"]) {
      const file = path.join(project, ".spectra/sdd/memory-bank/core", name);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/<[^>]+>/g, "release-fixture").replaceAll("YYYY-MM-DD", "2026-10-02"));
    }
    const protectedFiles = { [brief]: hash(brief), [plugin]: hash(plugin) };
    invoke(["doctor", "--fix"]);
    const alias = path.join(root, `${mode.name}-alias`);
    fs.symlinkSync(project, alias, "dir");
    invoke(["doctor", "--fix", "--cwd", alias]);
    run(launcher, ["update", "--yes"], project, { ...mode.env, SPECTRA_LATEST_VERSION: version });
    invoke(["adopt", ".", "--git-mode", "local"]);
    invoke(["check"]);
    const sibling = path.join(root, `${mode.name}-new-project`);
    releaseProjects.push(sibling);
    invoke(["init", sibling, "--git-mode", "shared"]);
    assert.match(run(path.join(sibling, ".spectra/bin/spectra"), ["version"], sibling, mode.env), new RegExp(version.replaceAll(".", "\\.")));
    for (const [file, digest] of Object.entries(protectedFiles)) assert.equal(hash(file), digest, `User file changed: ${file}`);
    assert.equal(JSON.parse(fs.readFileSync(metaFile, "utf8")).docsProjectName, meta.docsProjectName);
    report.projects.push({ mode: mode.name, docsProjectName: meta.docsProjectName, before, after: inventory(project), protectedFiles });
  }
  const npmUninstallGuidance = run(process.execPath, [npmBin, "uninstall"], root);
  assert.match(npmUninstallGuidance, /npm uninstall -g spectra-pack/);
  const nativeMode = modes.find(mode => mode.name === "native");
  const nativeProjectsBefore = releaseProjects.map(project => inventory(project));
  const nativeHomeBefore = inventory(installerEnv.SPECTRA_HOME);
  const commandTargetBeforeUninstall = fs.readlinkSync(installedNative);
  run(installedNative, ["uninstall"], root, nativeMode.env, 1);
  assert.deepEqual(inventory(installerEnv.SPECTRA_HOME), nativeHomeBefore, "Non-TTY uninstall without --yes must not mutate the installation");
  assert.equal(fs.readlinkSync(installedNative), commandTargetBeforeUninstall);
  const uninstallOutput = run(installedNative, ["uninstall", "--yes"], root, nativeMode.env);
  assert.match(uninstallOutput, /Removed/);
  assert.deepEqual(releaseProjects.map(project => inventory(project)), nativeProjectsBefore, "Uninstall must preserve project trees and Git excludes");
  assert.equal(fs.existsSync(installerEnv.SPECTRA_HOME), false);
  run(path.join(root, "npm-acme/.spectra/bin/spectra"), ["check"], path.join(root, "npm-acme"));
  assert.deepEqual(releaseProjects.map(project => inventory(project)), nativeProjectsBefore, "Local Node fallback must work without machine installation");
  run("sh", [path.resolve("install.sh")], root, installerEnv);
  assert.match(run(installedNative, ["version"], root, nativeMode.env), new RegExp(version.replaceAll(".", "\\.")));
  run(path.join(root, "native-acme/.spectra/bin/spectra"), ["check"], path.join(root, "native-acme"), nativeMode.env);
  report.passed = true;
} finally {
  fs.writeFileSync(path.join(root, "results.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(`Release E2E passed: ${version}; artifact ${root}/results.json`);
