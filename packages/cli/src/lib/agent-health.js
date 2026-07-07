import fs from "node:fs";
import path from "node:path";
import { hasCommand } from "./runtime.js";

const AGENT_DEFINITIONS = {
  claude: {
    displayName: "Claude",
    files: [
      {
        path: "CLAUDE.md",
        header: "# Spectra Core Instructions"
      }
    ]
  },
  copilot: {
    displayName: "Copilot",
    files: [
      {
        path: ".github/copilot-instructions.md",
        header: "# Spectra Copilot Instructions"
      }
    ]
  },
  codex: {
    displayName: "Codex",
    files: [
      {
        path: "AGENTS.md",
        header: "# Spectra Adapter (Codex)"
      }
    ],
    cliCommand: () => process.env.SPECTRA_CODEX_COMMAND ?? "codex"
  },
  cursor: {
    displayName: "Cursor",
    files: [
      {
        path: ".cursor/rules/spectra-core.mdc",
        header: "# Spectra Core"
      },
      {
        path: ".cursor/rules/spectra-workflow.mdc",
        header: "# Spectra Workflow"
      },
      {
        path: ".cursor/rules/spectra-context.mdc",
        header: "# Spectra Context Routing"
      }
    ]
  },
  windsurf: {
    displayName: "Windsurf",
    files: [
      {
        path: ".windsurf/rules/spectra-core.md",
        header: "# Spectra Core"
      },
      {
        path: ".windsurf/rules/spectra-workflow.md",
        header: "# Spectra Workflow"
      },
      {
        path: ".windsurf/rules/spectra-context.md",
        header: "# Spectra Context"
      }
    ]
  },
  antigravity: {
    displayName: "Antigravity",
    files: [
      {
        path: ".agent/rules/spectra-core.md",
        header: "# Spectra Core"
      },
      {
        path: ".agent/rules/spectra-workflow.md",
        header: "# Spectra Workflow"
      },
      {
        path: ".agent/rules/spectra-context.md",
        header: "# Spectra Context"
      }
    ]
  }
};

function normalizeAgents(agents) {
  if (Array.isArray(agents)) {
    return agents.map((agent) => String(agent).trim()).filter(Boolean);
  }

  if (typeof agents !== "string") {
    return [];
  }

  return agents
    .split(",")
    .map((agent) => agent.trim())
    .filter(Boolean);
}

function readStartsWith(filePath, expectedHeader, readFile) {
  try {
    const content = readFile(filePath, "utf8");
    return content.startsWith(expectedHeader);
  } catch {
    return false;
  }
}

function checkAgentHealth(
  targetRoot,
  agent,
  {
    fileExists = fs.existsSync,
    readFile = fs.readFileSync,
    commandExists = hasCommand
  } = {}
) {
  const definition = AGENT_DEFINITIONS[agent];
  if (!definition) {
    throw new Error(`Unsupported agent health check: ${agent}`);
  }

  const fileChecks = definition.files.map((entry) => {
    const absolutePath = path.join(targetRoot, entry.path);
    const exists = fileExists(absolutePath);
    const valid = exists && readStartsWith(absolutePath, entry.header, readFile);

    return {
      name: entry.path,
      status: exists ? (valid ? "ok" : "invalid") : "missing",
      detail: exists
        ? valid
          ? `${entry.path} matches the Spectra ${definition.displayName} adapter`
          : `${entry.path} does not match the Spectra ${definition.displayName} adapter`
        : `${entry.path} is missing`
    };
  });

  const detected = fileChecks.some((check) => check.status !== "missing");

  const checks = [...fileChecks];
  if (definition.cliCommand) {
    const commandName = definition.cliCommand();
    const available = commandExists(commandName);
    checks.push({
      name: commandName,
      status: available ? "ok" : "missing",
      detail: available ? `${commandName} is available on PATH` : `${commandName} is missing from PATH`
    });
  }

  const healthy = detected && checks.every((check) => check.status === "ok");

  return {
    agent,
    displayName: definition.displayName,
    detected,
    healthy,
    checks
  };
}

function checkAgentsHealth(targetRoot, agents, options = {}) {
  return normalizeAgents(agents).map((agent) => checkAgentHealth(targetRoot, agent, options));
}

export { AGENT_DEFINITIONS, checkAgentHealth, checkAgentsHealth, normalizeAgents };
