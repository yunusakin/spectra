import { adoptCommand } from "./commands/adopt.js";
import { adaptersGenerateCommand } from "./commands/adapters-generate.js";
import { approveCommand } from "./commands/approve.js";
import { contextPackCommand } from "./commands/context-pack.js";
import { doctorCommand } from "./commands/doctor.js";
import { discussTaskCommand } from "./commands/discuss-task.js";
import { evalRunCommand } from "./commands/eval-run.js";
import { initCommand } from "./commands/init.js";
import { knowledgeCommand } from "./commands/knowledge.js";
import { quickCommand } from "./commands/quick.js";
import { routeCommand } from "./commands/route.js";
import { specDiffCommand } from "./commands/spec-diff.js";
import { skillsResolveCommand } from "./commands/skills-resolve.js";
import { statusCommand } from "./commands/status.js";
import { validateCommand } from "./commands/validate.js";
import { checkCommand } from "./commands/check.js";
import { adminCommand } from "./commands/admin.js";
import { verifyCommand } from "./commands/verify.js";
import { printHelp as printCommandHelp } from "./commands/help.js";
import { internalUpdateProjectCommand, updateCommand } from "./commands/update.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { fail, title } from "./lib/output.js";
import { getCliVersion } from "./lib/version.js";

function normalizeCommand(command, subcommand, ...rest) {
  switch (command) {
    case "context":
      return { command: "context-pack", subcommand, rest };
    case "task":
      return { command: "discuss-task", subcommand, rest };
    case "skills":
      if (subcommand === undefined || subcommand.startsWith("-")) {
        return {
          command: "skills",
          subcommand: "resolve",
          rest: [subcommand, ...rest].filter(Boolean)
        };
      }
      return { command, subcommand, rest };
    case "eval":
      if (subcommand === undefined || subcommand !== "run") {
        return {
          command: "eval",
          subcommand: "run",
          rest: [subcommand, ...rest].filter(Boolean)
        };
      }
      return { command, subcommand, rest };
    case "adapters":
      if (subcommand === undefined || subcommand.startsWith("-")) {
        return {
          command: "adapters",
          subcommand: "generate",
          rest: [subcommand, ...rest].filter(Boolean)
        };
      }
      return { command, subcommand, rest };
    case "diff":
      return {
        command: "spec",
        subcommand: "diff",
        rest: [subcommand, ...rest].filter(Boolean)
      };
    default:
      return { command, subcommand, rest };
  }
}

function dispatch(argv) {
  const normalized = normalizeCommand(...argv);
  const { command, subcommand, rest } = normalized;

  switch (command) {
    case undefined:
    case "--help":
    case "help":
      return printCommandHelp(subcommand);
    case "--version":
    case "version":
      title(`spectra ${getCliVersion()}`);
      return 0;
    case "check":
      return checkCommand([subcommand, ...rest].filter(Boolean));
    case "update":
      return updateCommand([subcommand, ...rest].filter(Boolean));
    case "upgrade":
      return upgradeCommand([subcommand, ...rest].filter(Boolean));
    case "__update-project":
      return internalUpdateProjectCommand([subcommand, ...rest].filter(Boolean));
    case "admin":
      return adminCommand(subcommand, rest);
    case "init":
      return initCommand([subcommand, ...rest].filter(Boolean));
    case "adopt":
      return adoptCommand([subcommand, ...rest].filter(Boolean));
    case "validate":
      return validateCommand([subcommand, ...rest].filter(Boolean));
    case "approve":
      return approveCommand([subcommand, ...rest].filter(Boolean));
    case "context-pack":
      return contextPackCommand([subcommand, ...rest].filter(Boolean));
    case "route":
      return routeCommand([subcommand, ...rest].filter(Boolean));
    case "knowledge":
      return knowledgeCommand([subcommand, ...rest].filter(Boolean));
    case "discuss-task":
      return discussTaskCommand([subcommand, ...rest].filter(Boolean));
    case "verify":
      return verifyCommand([subcommand, ...rest].filter(Boolean));
    case "quick":
      return quickCommand([subcommand, ...rest].filter(Boolean));
    case "status":
      return statusCommand([subcommand, ...rest].filter(Boolean));
    case "doctor":
      return doctorCommand([subcommand, ...rest].filter(Boolean));
    case "skills":
      if (subcommand === "resolve") {
        return skillsResolveCommand(rest);
      }
      throw new Error("Usage: spectra skills --task-type <type> [--skills <csv>]");
    case "eval":
      if (subcommand === "run") {
        return evalRunCommand(rest);
      }
      throw new Error("Usage: spectra eval [feature-id] [--suite <smoke|release>]");
    case "adapters":
      if (subcommand === "generate") {
        return adaptersGenerateCommand(rest);
      }
      throw new Error("Usage: spectra adapters --agents <csv> [--target <path>]");
    case "spec":
      if (subcommand === "diff") {
        return specDiffCommand(rest);
      }
      throw new Error("Usage: spectra diff <init|update|semantic> [options]");
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function main(argv) {
  try {
    const status = await dispatch(argv);
    process.exit(status);
  } catch (error) {
    fail(error.message);
    process.exit(1);
  }
}

export { main };
