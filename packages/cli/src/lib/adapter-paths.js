const ADAPTER_PATHS = {
  antigravity: [
    ".agent/rules/spectra-context.md",
    ".agent/rules/spectra-core.md",
    ".agent/rules/spectra-workflow.md"
  ],
  claude: ["CLAUDE.md"],
  codex: ["AGENTS.md"],
  copilot: [".github/copilot-instructions.md"],
  cursor: [
    ".cursor/rules/spectra-context.mdc",
    ".cursor/rules/spectra-core.mdc",
    ".cursor/rules/spectra-workflow.mdc"
  ],
  windsurf: [
    ".windsurf/rules/spectra-context.md",
    ".windsurf/rules/spectra-core.md",
    ".windsurf/rules/spectra-workflow.md"
  ]
};

function getAdapterOutputPaths(agentsCsv) {
  const agents = String(agentsCsv ?? "")
    .split(",")
    .map((agent) => agent.trim())
    .filter(Boolean);
  return [...new Set(agents.flatMap((agent) => ADAPTER_PATHS[agent] ?? []))].sort();
}

export { getAdapterOutputPaths };
