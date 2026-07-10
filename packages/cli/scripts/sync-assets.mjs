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
fs.rmSync(path.join(cliRoot, "assets", "base"), { recursive: true, force: true });
const profilesSource = path.resolve(cliRoot, "..", "..", "profiles");
replaceDirectory(profilesSource, path.join(cliRoot, "assets", "profiles"));
replaceDirectory(profilesSource, path.resolve(cliRoot, "../templates/assets/profiles"));
