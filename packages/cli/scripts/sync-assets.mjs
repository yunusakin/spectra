import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(scriptDir, "..");

function replaceDirectory(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

replaceDirectory(path.resolve(cliRoot, "../core/assets/runtime"), path.join(cliRoot, "assets", "runtime"));
replaceDirectory(path.resolve(cliRoot, "../templates/assets/base"), path.join(cliRoot, "assets", "base"));
