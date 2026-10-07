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
const profileSource = path.resolve(cliRoot, "..", "..", "profiles", "full");
fs.rmSync(path.join(cliRoot, "assets", "profiles"), { recursive: true, force: true });
fs.rmSync(path.resolve(cliRoot, "../templates/assets/profiles"), { recursive: true, force: true });
replaceDirectory(profileSource, path.join(cliRoot, "assets", "profiles", "full"));
replaceDirectory(profileSource, path.resolve(cliRoot, "../templates/assets/profiles/full"));

// Tracked mirrors of the authoritative sources. Not part of the default run (pretest/prepack): a test that silently
// rewrote committed files could never detect drift. test/source-repo-alignment.test.js enforces these; run with --tracked
// after changing profiles/full/sdd/system or packages/core/assets/runtime/scripts.
if (process.argv.includes("--tracked")) {
  const repoRoot = path.resolve(cliRoot, "..", "..");
  const consumerSystem = path.join(profileSource, "sdd", "system");
  replaceDirectory(consumerSystem, path.resolve(cliRoot, "../core/assets/runtime/sdd/system"));
  replaceDirectory(consumerSystem, path.join(repoRoot, "sdd", "system"));
  const runtimeScripts = path.resolve(cliRoot, "../core/assets/runtime/scripts");
  for (const name of fs.readdirSync(runtimeScripts)) {
    // The source repository's validator adds source-specific checks; it is kept in step by a subsequence check instead.
    if (name !== "validate-repo.sh") fs.copyFileSync(path.join(runtimeScripts, name), path.join(repoRoot, "scripts", name));
  }
}
