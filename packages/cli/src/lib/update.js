import path from "node:path";
import { inspectApplicationInstallation, planApplicationUpdate, adoptLegacyNativeInstallation, VERSION_PATTERN } from "./application-installation.js";
import { spawnSync } from "node:child_process";
import { fail } from "./output.js";

function versionParts(version) {
  const normalized = String(version).trim().replace(/^v/, "");
  if (!VERSION_PATTERN.test(normalized)) throw new Error(`Invalid Spectra version: ${version}`);
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
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

function runSelfUpdate(latest, installation = inspectApplicationInstallation()) {
  latest = String(latest).replace(/^v/, "");
  if (installation.kind !== "native-managed") {
    const guidance = installation.kind === "npm"
      ? `Use your package manager: npm install -g spectra-pack@${latest}.`
      : `Install the machine application with curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/v${latest}/install.sh | sh, or npm install -g spectra-pack@${latest}.`;
    const transition = installation.nativeRuntime
      ? ` To preserve the unverified installation, create a fresh managed home without deleting it:\n  spectra_root="$(mktemp -d \"$HOME/spectra-XXXXXX\")"\n  curl -fsSL https://raw.githubusercontent.com/yunusakin/spectra/v${latest}/install.sh | SPECTRA_VERSION=v${latest} SPECTRA_HOME="$spectra_root/runtime" SPECTRA_BIN="$spectra_root/bin" sh\n  export PATH="$spectra_root/bin:$PATH"`
      : "";
    fail(`Software update was not applied: ${installation.reason}. ${guidance}${transition}`);
    return 1;
  }
  try {
    const plan = planApplicationUpdate(installation, latest);
    const ownedInstallation = adoptLegacyNativeInstallation(plan.installation);
    const executing = ownedInstallation.versions.find(version => version.executablePath === installation.execPath);
    const installer = path.join(executing.directory, "install.sh");
    const result = spawnSync("sh", [installer], {
      env: { ...process.env, SPECTRA_HOME: plan.home, SPECTRA_BIN: path.dirname(plan.commandPath), SPECTRA_VERSION: `v${plan.version}` },
      stdio: "inherit"
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Native installer did not activate Spectra ${plan.version} (status ${result.status}).`);
    const activated = spawnSync(plan.commandPath, ["version"], { encoding: "utf8" });
    if (activated.status !== 0 || activated.stdout.trim() !== `spectra ${plan.version}`) throw new Error(`Activated application version does not equal requested version ${plan.version}.`);
    return 0;
  } catch (error) {
    fail(`Software update was not applied: ${error.message}`);
    return 1;
  }
}

export { compareVersions, latestVersion, resolveInstalledNativeCommand, runSelfUpdate };
