import path from "node:path";
import { spawnSync } from "node:child_process";
import { fail } from "./output.js";

function versionParts(version) {
  const match = String(version).trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Invalid Spectra version: ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function latestVersion(env = process.env, spawn = spawnSync) {
  if (env.SPECTRA_LATEST_VERSION) return env.SPECTRA_LATEST_VERSION;
  const npmResult = spawn("npm", ["view", "spectra-pack", "version"], { encoding: "utf8" });
  if (npmResult.status === 0 && npmResult.stdout.trim()) return npmResult.stdout.trim();
  const curlResult = spawn("curl", ["-fsSL", "https://api.github.com/repos/yunusakin/spectra/releases/latest"], { encoding: "utf8" });
  const match = curlResult.status === 0 && curlResult.stdout.match(/"tag_name"\s*:\s*"v?([^"]+)"/);
  if (match) return match[1];
  throw new Error("Could not check the latest Spectra version.");
}

function resolveInstalledNativeCommand(env = process.env) {
  const home = env.HOME || env.USERPROFILE;
  const binaryDir = env.SPECTRA_BIN || (home ? path.join(home, ".local", "bin") : null);
  if (!binaryDir) throw new Error("Could not resolve the installed Spectra binary: HOME and SPECTRA_BIN are unset.");
  return path.join(binaryDir, process.platform === "win32" ? "spectra.exe" : "spectra");
}

function runSelfUpdate(latest, installation = { kind: "unmanaged" }) {
  // Machine mutation requires the ownership proof supplied by the native installer.
  // A Node/npx/project-local invocation is never permission to update another install.
  const guidance = installation.kind === "npm"
    ? `Use your package manager: npm install -g spectra-pack@${latest}.`
    : `Install Spectra ${latest} with the machine installer, or use npm install -g spectra-pack@${latest}.`;
  fail(`Software update was not applied: ${installation.reason ?? "machine installation ownership is not verified"}. ${guidance}`);
  return 1;
}

export { compareVersions, latestVersion, resolveInstalledNativeCommand, runSelfUpdate };
