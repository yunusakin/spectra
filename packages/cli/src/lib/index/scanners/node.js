import fs from "node:fs";
import path from "node:path";
import { createRecord, evidenceEntry } from "../model.js";
import { toPosixRelative, readTextFile } from "../fs-walk.js";

const ECOSYSTEM = "node";

const FRONTEND_DEP_HINTS = {
  next: "Next.js",
  nuxt: "Nuxt",
  vite: "Vite",
  react: "React",
  vue: "Vue",
  "@angular/core": "Angular",
  svelte: "Svelte"
};

const FRONTEND_CONFIG_HINTS = {
  "next.config.js": "Next.js",
  "next.config.mjs": "Next.js",
  "next.config.ts": "Next.js",
  "vite.config.js": "Vite",
  "vite.config.ts": "Vite",
  "angular.json": "Angular",
  "svelte.config.js": "Svelte",
  "vue.config.js": "Vue"
};

function detect(repoRoot) {
  return fs.existsSync(path.join(repoRoot, "package.json"));
}

function readJson(absolutePath) {
  return JSON.parse(readTextFile(absolutePath));
}

function expandWorkspaceGlob(repoRoot, pattern) {
  // Supports the common "dir/*" workspace pattern shape plus a bare dir.
  if (!pattern.includes("*")) {
    const dir = path.join(repoRoot, pattern);
    return fs.existsSync(dir) ? [dir] : [];
  }
  const starIndex = pattern.indexOf("*");
  const prefix = pattern.slice(0, starIndex).replace(/\/$/, "");
  const baseDir = path.join(repoRoot, prefix);
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(baseDir, entry.name));
}

function readPnpmWorkspacePackages(repoRoot) {
  const pnpmFile = path.join(repoRoot, "pnpm-workspace.yaml");
  if (!fs.existsSync(pnpmFile)) {
    return null;
  }
  const text = readTextFile(pnpmFile);
  const packages = [];
  let inPackages = false;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/#.*$/, "");
    if (/^packages\s*:/.test(line.trim())) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const itemMatch = /^\s*-\s*['"]?([^'"]+)['"]?\s*$/.exec(line);
      if (itemMatch) {
        packages.push(itemMatch[1].trim());
        continue;
      }
      if (line.trim() === "") {
        continue;
      }
      break;
    }
  }
  return { file: pnpmFile, packages };
}

function scanNode(ctx) {
  const { repoRoot, touch } = ctx;
  if (!detect(repoRoot)) {
    return [];
  }

  const rootPkgPath = path.join(repoRoot, "package.json");
  touch(rootPkgPath);
  const rootPkg = readJson(rootPkgPath);

  const workspaceDirs = new Set();
  let workspaceEvidence = null;

  if (Array.isArray(rootPkg.workspaces) || Array.isArray(rootPkg.workspaces?.packages)) {
    const patterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages;
    workspaceEvidence = evidenceEntry(toPosixRelative(repoRoot, rootPkgPath), "workspaces");
    for (const pattern of patterns) {
      for (const dir of expandWorkspaceGlob(repoRoot, pattern)) {
        workspaceDirs.add(dir);
      }
    }
  } else {
    const pnpm = readPnpmWorkspacePackages(repoRoot);
    if (pnpm) {
      touch(pnpm.file);
      workspaceEvidence = evidenceEntry(toPosixRelative(repoRoot, pnpm.file), "packages");
      for (const pattern of pnpm.packages) {
        for (const dir of expandWorkspaceGlob(repoRoot, pattern)) {
          workspaceDirs.add(dir);
        }
      }
    }
  }

  const packageDirs = workspaceDirs.size > 0 ? [repoRoot, ...workspaceDirs] : [repoRoot];
  const records = [];

  for (const dir of packageDirs) {
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) {
      continue;
    }
    touch(pkgPath);
    const pkg = readJson(pkgPath);
    const relDir = toPosixRelative(repoRoot, dir) || ".";
    const relPkg = toPosixRelative(repoRoot, pkgPath);
    const moduleName = pkg.name ?? relDir;
    const isRoot = dir === repoRoot;

    const moduleEvidence = [evidenceEntry(relPkg, "name")];
    if (isRoot && workspaceEvidence) {
      moduleEvidence.push(workspaceEvidence);
    }

    records.push(
      createRecord({
        kind: "module",
        name: moduleName,
        path: relDir,
        ecosystem: ECOSYSTEM,
        confidence: "high",
        status: "confirmed",
        evidence: moduleEvidence,
        attributes: {
          version: pkg.version,
          private: Boolean(pkg.private),
          isWorkspaceRoot: isRoot && workspaceDirs.size > 0,
          scripts: pkg.scripts ?? {}
        }
      })
    );

    if (pkg.scripts?.test) {
      records.push(
        createRecord({
          kind: "test-target",
          name: `${moduleName}:test`,
          path: relDir,
          ecosystem: ECOSYSTEM,
          confidence: "high",
          status: "confirmed",
          evidence: [evidenceEntry(relPkg, "scripts.test")],
          attributes: { command: pkg.scripts.test }
        })
      );
    }

    if (pkg.scripts?.build) {
      records.push(
        createRecord({
          kind: "build-target",
          name: `${moduleName}:build`,
          path: relDir,
          ecosystem: ECOSYSTEM,
          confidence: "high",
          status: "confirmed",
          evidence: [evidenceEntry(relPkg, "scripts.build")],
          attributes: { command: pkg.scripts.build }
        })
      );
    }

    for (const [field, value] of Object.entries({ main: pkg.main, module: pkg.module })) {
      if (typeof value === "string") {
        records.push(
          createRecord({
            kind: "entrypoint",
            name: `${moduleName}:${field}`,
            path: path.posix.join(relDir, value),
            ecosystem: ECOSYSTEM,
            confidence: "high",
            status: "confirmed",
            evidence: [evidenceEntry(relPkg, field)]
          })
        );
      }
    }
    if (pkg.bin) {
      const binEntries = typeof pkg.bin === "string" ? { [moduleName]: pkg.bin } : pkg.bin;
      for (const [binName, binPath] of Object.entries(binEntries)) {
        records.push(
          createRecord({
            kind: "entrypoint",
            name: `${moduleName}:bin:${binName}`,
            path: path.posix.join(relDir, binPath),
            ecosystem: ECOSYSTEM,
            confidence: "high",
            status: "confirmed",
            evidence: [evidenceEntry(relPkg, `bin.${binName}`)]
          })
        );
      }
    }

    const dependencyGroups = [
      { field: "dependencies", values: pkg.dependencies ?? {}, dev: false },
      { field: "devDependencies", values: pkg.devDependencies ?? {}, dev: true }
    ];
    for (const { field, values, dev } of dependencyGroups) {
      for (const [depName, depRange] of Object.entries(values)) {
        records.push(
          createRecord({
            kind: "dependency",
            name: depName,
            path: null,
            ecosystem: ECOSYSTEM,
            confidence: "high",
            status: "confirmed",
            evidence: [evidenceEntry(relPkg, `${field}.${depName}`)],
            attributes: { range: depRange, dev },
            relationships: { dependsOn: [] }
          })
        );
      }
    }

    const depNames = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {})
    ]);
    for (const [dep, framework] of Object.entries(FRONTEND_DEP_HINTS)) {
      if (depNames.has(dep)) {
        const depField = Object.prototype.hasOwnProperty.call(pkg.dependencies ?? {}, dep)
          ? "dependencies"
          : "devDependencies";
        const configHit = Object.entries(FRONTEND_CONFIG_HINTS).find(
          ([file, fw]) => fw === framework && fs.existsSync(path.join(dir, file))
        );
        records.push(
          createRecord({
            kind: "runtime",
            name: framework,
            path: relDir,
            ecosystem: ECOSYSTEM,
            confidence: configHit ? "high" : "medium",
            status: configHit ? "confirmed" : "candidate",
            evidence: configHit
              ? [evidenceEntry(relPkg, `${depField}.${dep}`), evidenceEntry(toPosixRelative(repoRoot, path.join(dir, configHit[0])))]
              : [evidenceEntry(relPkg, `${depField}.${dep}`)],
            attributes: { framework }
          })
        );
      }
    }
  }

  return records;
}

export { scanNode, detect as detectNode };
