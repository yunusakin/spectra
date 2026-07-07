import path from "node:path";
import { getAdapterOutputPaths } from "../lib/adapter-paths.js";
import { assertPathsUntracked, beginLocalGitPolicy, finishLocalGitPolicy } from "../lib/git-policy.js";
import {
  findSpectraRoot,
  readInstallMetadata,
  runInstalledScript,
  writeInstallMetadata
} from "../lib/runtime.js";
import { title } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";

function adaptersGenerateCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--agents", "--target"]
  });

  if (options["--help"]) {
    title("Usage: spectra adapters --agents <csv> [--cwd <path>] [--target <path>]");
    return 0;
  }

  if (!options["--agents"]) {
    throw new Error("Missing required flag: --agents");
  }

  const cwd = options["--cwd"] ?? process.cwd();
  const repoRoot = findSpectraRoot(cwd);
  const target = path.resolve(options["--target"] ?? options["--cwd"] ?? process.cwd());
  const metadata = repoRoot ? readInstallMetadata(repoRoot) : null;
  const usesLocalPolicy = metadata?.gitMode === "local" && path.resolve(repoRoot) === target;
  const localPolicy = usesLocalPolicy ? beginLocalGitPolicy(target) : null;
  if (localPolicy) {
    assertPathsUntracked(target, getAdapterOutputPaths(options["--agents"]), "adapter path");
  }

  const status = runInstalledScript({
    cwd,
    scriptName: "generate-adapters.sh",
    args: [
      "--agents",
      options["--agents"],
      "--target",
      target
    ]
  });

  if (localPolicy) {
    const result = finishLocalGitPolicy(localPolicy, {
      ownedPaths: metadata.ownedPaths,
      excludePatterns: metadata.excludePatterns
    });
    writeInstallMetadata(repoRoot, {
      ...metadata,
      ownedPaths: result.ownedPaths,
      excludePatterns: result.excludePatterns
    });
  }

  return status;
}

export { adaptersGenerateCommand };
