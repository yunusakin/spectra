import { runInstalledScript } from "../lib/runtime.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { parseOptions } from "../lib/options.js";
import { findSpectraRoot } from "../lib/runtime.js";
import { validateSpectraV2 } from "../lib/specs.js";

function validateCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--base", "--head"]
  });

  if (options["--help"]) {
    title("Usage: spectra validate [--cwd <path>] [--base <ref> --head <ref>]");
    return 0;
  }

  const cwd = options["--cwd"] ?? process.cwd();
  const validateStatus = runInstalledScript({
    cwd,
    scriptName: "validate-repo.sh",
    args: ["--strict"]
  });

  if (validateStatus !== 0) {
    fail("Repo validation failed");
    return validateStatus;
  }

  const policyArgs = [];
  if (options["--base"] || options["--head"]) {
    policyArgs.push("--base", options["--base"] ?? "", "--head", options["--head"] ?? "");
  }

  const policyStatus = runInstalledScript({
    cwd,
    scriptName: "check-policy.sh",
    args: policyArgs
  });

  if (policyStatus !== 0) {
    fail("Policy checks failed");
    return policyStatus;
  }

  const repoRoot = findSpectraRoot(cwd);
  if (!repoRoot) {
    fail(`Could not find a Spectra runtime from ${cwd}`);
    return 1;
  }

  const v2 = validateSpectraV2(repoRoot);
  for (const warning of v2.warnings) {
    warn(warning);
  }

  if (!v2.ok) {
    for (const error of v2.errors) {
      fail(error);
    }
    return 1;
  }

  ok("Validation and policy checks passed");
  return 0;
}

export { validateCommand };
