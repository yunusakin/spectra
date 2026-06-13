import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(cliRoot, "..", "..");
const distRoot = path.join(cliRoot, "dist", "native");
const buildRoot = path.join(distRoot, "build");
const packageRoot = path.join(distRoot, "package");
const packageJson = JSON.parse(fs.readFileSync(path.join(cliRoot, "package.json"), "utf8"));

const fuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? cliRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }

  return result;
}

function tryRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? cliRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function commandOutput(command, args) {
  const result = run(command, args, { stdio: "pipe" });
  return String(result.stdout).trim();
}

function supportsBuildSea() {
  const result = spawnSync(nodeBinaryPath(), ["--help"], {
    cwd: cliRoot,
    stdio: "pipe"
  });

  return result.status === 0 && String(result.stdout).includes("--build-sea");
}

function targetName() {
  const platformMap = {
    darwin: "darwin",
    linux: "linux"
  };
  const archMap = {
    arm64: "arm64",
    x64: "x64"
  };

  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];

  if (!platform || !arch) {
    throw new Error(`Unsupported native build target: ${process.platform}-${process.arch}`);
  }

  return `spectra-${platform}-${arch}`;
}

function nodeBinaryPath() {
  return process.execPath;
}

function postjectBin() {
  const extension = process.platform === "win32" ? ".cmd" : "";
  return path.join(repoRoot, "node_modules", ".bin", `postject${extension}`);
}

function makeExecutable(filePath) {
  fs.chmodSync(filePath, 0o755);
}

function copyDirectory(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(buildRoot, { recursive: true });
fs.mkdirSync(packageRoot, { recursive: true });

run("node", [path.join(scriptDir, "sync-assets.mjs")]);

const bundledEntry = path.join(buildRoot, "spectra.cjs");
await build({
  entryPoints: [path.join(cliRoot, "bin", "spectra.js")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: bundledEntry,
  logOverride: {
    "empty-import-meta": "silent"
  }
});

// Node SEA embeds this file as CommonJS source. Unlike the normal CLI bin,
// the embedded source must not contain a shebang.
const bundledSource = fs.readFileSync(bundledEntry, "utf8");
fs.writeFileSync(bundledEntry, bundledSource.replace(/^(?:#![^\n]*\n)+/, ""));

const target = targetName();
const executablePath = path.join(buildRoot, "spectra");
const seaConfigPath = path.join(buildRoot, "sea-config.json");
const seaBlobPath = path.join(buildRoot, "sea-prep.blob");

if (supportsBuildSea()) {
  fs.writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        main: bundledEntry,
        mainFormat: "commonjs",
        executable: nodeBinaryPath(),
        output: executablePath,
        disableExperimentalSEAWarning: true
      },
      null,
      2
    )
  );

  if (tryRun(nodeBinaryPath(), ["--build-sea", seaConfigPath]) !== 0) {
    throw new Error(
      [
        "Node SEA build failed for the current Node binary.",
        "Use an official Node.js binary that includes the SEA fuse, for example actions/setup-node in CI or Node from nodejs.org.",
        `Current binary: ${nodeBinaryPath()}`
      ].join("\n")
    );
  }
  makeExecutable(executablePath);
} else {
  fs.writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        main: bundledEntry,
        mainFormat: "commonjs",
        output: seaBlobPath,
        disableExperimentalSEAWarning: true
      },
      null,
      2
    )
  );

  run(nodeBinaryPath(), ["--experimental-sea-config", seaConfigPath]);
  fs.copyFileSync(nodeBinaryPath(), executablePath);
  makeExecutable(executablePath);

  if (process.platform === "darwin") {
    tryRun("codesign", ["--remove-signature", executablePath]);
  }

  const postjectArgs = [
    executablePath,
    "NODE_SEA_BLOB",
    seaBlobPath,
    "--sentinel-fuse",
    fuse,
    ...(process.platform === "darwin" ? ["--macho-segment-name", "NODE_SEA"] : [])
  ];

  if (tryRun(postjectBin(), postjectArgs) !== 0) {
    if (
      tryRun(postjectBin(), [
        executablePath,
        "NODE_SEA_BLOB",
        seaBlobPath,
        ...(process.platform === "darwin" ? ["--macho-segment-name", "NODE_SEA"] : [])
      ]) !== 0
    ) {
      throw new Error(
        [
          "Node SEA postject injection failed for the current Node binary.",
          "Use an official Node.js binary that includes the SEA/postject sentinel, for example actions/setup-node in CI or Node from nodejs.org.",
          `Current binary: ${nodeBinaryPath()}`
        ].join("\n")
      );
    }
  }
}

if (process.platform === "darwin") {
  run("codesign", ["--force", "--sign", "-", executablePath]);
}

const archiveRoot = path.join(packageRoot, target);
fs.mkdirSync(path.join(archiveRoot, "bin"), { recursive: true });
fs.copyFileSync(executablePath, path.join(archiveRoot, "bin", "spectra"));
makeExecutable(path.join(archiveRoot, "bin", "spectra"));
copyDirectory(path.join(cliRoot, "assets"), path.join(archiveRoot, "assets"));
fs.copyFileSync(path.join(cliRoot, "LICENSE"), path.join(archiveRoot, "LICENSE"));
fs.writeFileSync(path.join(archiveRoot, "VERSION"), `${packageJson.version}\n`);

const archiveName = `${target}.tar.gz`;
const archivePath = path.join(distRoot, archiveName);
run("tar", ["-czf", archivePath, "-C", archiveRoot, "."]);

const shasum = commandOutput("shasum", ["-a", "256", archivePath]);
fs.writeFileSync(`${archivePath}.sha256`, `${shasum}\n`);

console.log(archivePath);
