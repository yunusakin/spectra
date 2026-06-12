import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(cliRoot, "..", "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readSourceCliVersion() {
  const versionSource = fs.readFileSync(path.join(cliRoot, "src", "lib", "version.js"), "utf8");
  const match = versionSource.match(/CLI_VERSION\s*=\s*"([^"]+)"/);

  if (!match) {
    throw new Error("Could not read CLI_VERSION from packages/cli/src/lib/version.js");
  }

  return match[1];
}

const expectedVersion = readJson(path.join(repoRoot, "package.json")).version;
const versions = [
  ["root package.json", expectedVersion],
  ["packages/cli/package.json", readJson(path.join(cliRoot, "package.json")).version],
  ["packages/core/package.json", readJson(path.join(repoRoot, "packages", "core", "package.json")).version],
  [
    "packages/templates/package.json",
    readJson(path.join(repoRoot, "packages", "templates", "package.json")).version
  ],
  ["packages/cli/src/lib/version.js", readSourceCliVersion()]
];

const packageLockPath = path.join(repoRoot, "package-lock.json");
if (fs.existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath);
  versions.push(["package-lock.json root", packageLock.packages?.[""]?.version]);
  versions.push(["package-lock.json cli", packageLock.packages?.["packages/cli"]?.version]);
  versions.push(["package-lock.json core", packageLock.packages?.["packages/core"]?.version]);
  versions.push(["package-lock.json templates", packageLock.packages?.["packages/templates"]?.version]);
}

const mismatches = versions.filter(([, version]) => version !== expectedVersion);

if (mismatches.length > 0) {
  const details = mismatches.map(([name, version]) => `- ${name}: ${version ?? "missing"}`).join("\n");
  throw new Error(`Spectra versions must all match ${expectedVersion}.\n${details}`);
}

console.log(`Version parity OK: ${expectedVersion}`);
