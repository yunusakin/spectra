import fs from "node:fs";
import path from "node:path";
import {
  copyDirectory,
  copyFile,
  ensureDirectory,
  getRuntimeAssetsDir,
  mergeGitignore,
  removeFinderArtifacts,
  runInstalledScript,
  updateManifestRepoMode,
  writeInstallMetadata
} from "@spectra/core";
import { getBaseTemplateDir } from "@spectra/templates";
import { buildAdoptionArtifacts, ensureV2Scaffolding } from "./specs.js";

function installSpectra({ targetDir, adopt = false, agents = "" }) {
  const absoluteTarget = path.resolve(targetDir);
  const runtimeDir = getRuntimeAssetsDir();
  const templateDir = getBaseTemplateDir();

  ensureDirectory(absoluteTarget);

  copyDirectory(path.join(runtimeDir, "sdd", "system"), path.join(absoluteTarget, "sdd", "system"));

  copyDirectory(path.join(templateDir, "sdd", "memory-bank"), path.join(absoluteTarget, "sdd", "memory-bank"));
  copyDirectory(path.join(templateDir, "docs"), path.join(absoluteTarget, "docs"));
  copyDirectory(path.join(templateDir, ".github"), path.join(absoluteTarget, ".github"));
  copyDirectory(path.join(templateDir, "app"), path.join(absoluteTarget, "app"));

  for (const fileName of [".editorconfig", "CHANGELOG.md", "RELEASE_SUMMARY.md", "LICENSE"]) {
    copyFile(path.join(templateDir, fileName), path.join(absoluteTarget, fileName));
  }

  mergeGitignore(path.join(templateDir, ".gitignore"), path.join(absoluteTarget, ".gitignore"));
  updateManifestRepoMode(absoluteTarget, "consumer");
  ensureV2Scaffolding(absoluteTarget, { adopt });
  removeFinderArtifacts(absoluteTarget);
  writeInstallMetadata(absoluteTarget, {
    installedAt: new Date().toISOString(),
    installMode: adopt ? "adopt" : "init"
  });

  if (adopt) {
    runInstalledScript({
      cwd: absoluteTarget,
      scriptName: "map-codebase.sh",
      args: ["--root", absoluteTarget]
    });
    buildAdoptionArtifacts(absoluteTarget);
  }

  if (agents) {
    runInstalledScript({
      cwd: absoluteTarget,
      scriptName: "generate-adapters.sh",
      args: ["--agents", agents, "--target", absoluteTarget]
    });
  }

  return {
    targetDir: absoluteTarget,
    installed: fs.existsSync(path.join(absoluteTarget, ".spectra", "install.json"))
  };
}

export { installSpectra };
