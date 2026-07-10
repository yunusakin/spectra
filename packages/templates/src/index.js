import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseTemplateDir = path.join(packageRoot, "assets", "base");
const profileTemplateDir = path.join(packageRoot, "assets", "profiles");

function getBaseTemplateDir() {
  return baseTemplateDir;
}

function getProfileTemplateDir(profile) {
  if (profile !== "lite" && profile !== "full") {
    throw new Error(`Unsupported Spectra profile: ${profile}`);
  }
  const resolved = path.join(profileTemplateDir, profile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Missing packaged Spectra profile assets: ${profile}`);
  }
  return resolved;
}

export { getBaseTemplateDir, getProfileTemplateDir };
