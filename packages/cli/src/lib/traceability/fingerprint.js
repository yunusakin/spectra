import crypto from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { countsForFingerprint } from "../source-boundary.js";

// Content fingerprint of the sources a test target runs from: the current content of every git-tracked file
// under the directory the command runs in. Untracked files are left out on purpose, so output a test run
// writes next to its sources (coverage, snapshots, markers) never stales a sibling target; a new source
// file counts once it is added. Evidence is stale when the fingerprint changes. A ceiling, not a
// dependency analysis: a change in another directory that the tests exercise is not seen. null without git.
// Spectra's own files are the exception to "every tracked file": inside the Spectra data root only canonical declarations
// count (see source-boundary.js), so Spectra writing caches, reports, evidence or bookkeeping into a shared repository
// can never stale the evidence it just recorded.
function sourceFingerprint(projectRoot, directory) {
  const listed = spawnSync("git", ["ls-files", "-z", "--", directory], { cwd: projectRoot, maxBuffer: 256 * 1024 * 1024 });
  if (listed.status !== 0) return null;
  const hash = crypto.createHash("sha256");
  for (const file of listed.stdout.toString("utf8").split("\0").filter(Boolean).filter(countsForFingerprint).sort()) {
    let content;
    try {
      content = fs.readFileSync(`${projectRoot}/${file}`);
    } catch {
      continue; // listed but deleted in the working tree
    }
    hash.update(`${file}\0${crypto.createHash("sha1").update(content).digest("hex")}\n`);
  }
  return hash.digest("hex");
}

export { sourceFingerprint };
