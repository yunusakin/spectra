import fs from "node:fs";
import path from "node:path";
import { hasCommand } from "./runtime.js";

function hasSpectraCodexAdapter(targetRoot, fileExists = fs.existsSync) {
  return fileExists(path.join(targetRoot, "AGENTS.md"));
}

function hasExpectedCodexAdapterContent(targetRoot, readFile = fs.readFileSync) {
  try {
    const content = readFile(path.join(targetRoot, "AGENTS.md"), "utf8");
    return content.includes("# Spectra Adapter (Codex)");
  } catch {
    return false;
  }
}

function checkCodexHealth(
  targetRoot,
  {
    hasCodexCommand = hasCommand(process.env.SPECTRA_CODEX_COMMAND ?? "codex"),
    fileExists = fs.existsSync,
    readFile = fs.readFileSync
  } = {}
) {
  const agentsPath = path.join(targetRoot, "AGENTS.md");
  const detected = hasSpectraCodexAdapter(targetRoot, fileExists);
  const adapterValid = detected && hasExpectedCodexAdapterContent(targetRoot, readFile);
  const healthy = detected && adapterValid && hasCodexCommand;

  return {
    detected,
    healthy,
    checks: [
      {
        name: "AGENTS.md",
        status: detected ? "ok" : "missing",
        detail: detected ? `${agentsPath} is present` : `${agentsPath} is missing`
      },
      {
        name: "adapter",
        status: detected ? (adapterValid ? "ok" : "invalid") : "skipped",
        detail: detected
          ? adapterValid
            ? "AGENTS.md matches the Spectra Codex adapter"
            : "AGENTS.md does not match the Spectra Codex adapter"
          : "Adapter content check skipped because AGENTS.md is missing"
      },
      {
        name: "codex",
        status: hasCodexCommand ? "ok" : "missing",
        detail: hasCodexCommand ? "codex is available on PATH" : "codex is missing from PATH"
      }
    ]
  };
}

export { checkCodexHealth };
