import { runInstalledScript } from "./runtime.js";

// Runs verify-work.sh exactly as `spectra verify` does, so every caller that
// feeds verifyV2 (verify, release approval) shares one shell-check contract.
function runVerifyWork({ cwd, scope = null, item = null }) {
  const args = [];
  if (item) {
    args.push("--item", item);
  }
  if (scope) {
    args.push("--scope", scope);
  }
  return runInstalledScript({ cwd, scriptName: "verify-work.sh", args });
}

export { runVerifyWork };
