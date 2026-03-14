import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseTemplateDir = path.join(packageRoot, "assets", "base");

function getBaseTemplateDir() {
  return baseTemplateDir;
}

export { getBaseTemplateDir };
