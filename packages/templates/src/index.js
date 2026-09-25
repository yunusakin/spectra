import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDir = path.join(packageRoot, "assets", "profiles", "full");

function getTemplateDir() {
  if (!fs.existsSync(templateDir)) {
    throw new Error("Missing packaged Spectra runtime assets.");
  }
  return templateDir;
}

export { getTemplateDir };
