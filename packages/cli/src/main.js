import { adaptersCommand } from "./commands/adapters.js";
import { approveCommand } from "./commands/approve.js";
import { contextCommand } from "./commands/context.js";
import { doctorCommand } from "./commands/doctor.js";
import { taskCommand } from "./commands/task.js";
import { evalCommand } from "./commands/eval.js";
import { initCommand } from "./commands/init.js";
import { adoptCommand } from "./commands/adopt.js";
import { knowledgeCommand } from "./commands/knowledge.js";
import { quickCommand } from "./commands/quick.js";
import { routeCommand } from "./commands/route.js";
import { diffCommand } from "./commands/diff.js";
import { skillsCommand } from "./commands/skills.js";
import { statusCommand } from "./commands/status.js";
import { validateCommand } from "./commands/validate.js";
import { checkCommand } from "./commands/check.js";
import { indexCommand } from "./commands/index.js";
import { onboardCommand } from "./commands/onboard.js";
import { verifyCommand } from "./commands/verify.js";
import { printHelp as printCommandHelp } from "./commands/help.js";
import { internalUpdateProjectCommand, updateCommand } from "./commands/update.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { fail, title } from "./lib/output.js";
import { getCliVersion } from "./lib/version.js";

// Compatibility adapter layer. The public vocabulary is canonical
// internally: context, task, eval, skills, adapters, diff. Legacy forms
// (context-pack, discuss-task, eval run, skills resolve, adapters
// generate, spec diff, admin <command>) normalize to their canonical
// command before dispatch so old documentation and scripts keep working
// without shaping the architecture.
const LEGACY_ADMIN_COMMANDS = new Set([
  "approve",
  "eval",
  "diff",
  "adapters",
  "doctor",
  "skills",
  "quick"
]);

function normalizeCommand(command, subcommand, ...rest) {
  switch (command) {
    case "context-pack":
      return { command: "context", subcommand, rest };
    case "discuss-task":
      return { command: "task", subcommand, rest };
    case "spec":
      if (subcommand === "diff") {
        return { command: "diff", subcommand: rest[0], rest: rest.slice(1) };
      }
      return { command, subcommand, rest };
    case "eval":
      if (subcommand === "run") {
        return { command, subcommand: rest[0], rest: rest.slice(1) };
      }
      return { command, subcommand, rest };
    case "skills":
      if (subcommand === "resolve") {
        return { command, subcommand: rest[0], rest: rest.slice(1) };
      }
      return { command, subcommand, rest };
    case "adapters":
      if (subcommand === "generate") {
        return { command, subcommand: rest[0], rest: rest.slice(1) };
      }
      return { command, subcommand, rest };
    case "admin":
      if (LEGACY_ADMIN_COMMANDS.has(subcommand)) {
        return { command: subcommand, subcommand: rest[0], rest: rest.slice(1) };
      }
      return { command, subcommand, rest };
    default:
      return { command, subcommand, rest };
  }
}

function dispatch(argv) {
  const normalized = normalizeCommand(...argv);
  const { command, subcommand, rest } = normalized;
  const args = [subcommand, ...rest].filter(Boolean);

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
      return checkCommand(args);
    case "index":
      return indexCommand(args);
    case "onboard":
      return onboardCommand(args);
    case "update":
      return updateCommand(args);
    case "upgrade":
      return upgradeCommand(args);
    case "__update-project":
      return internalUpdateProjectCommand(args);
    case "init":
      return initCommand(args);
    case "adopt":
      return adoptCommand(args);
    case "validate":
      return validateCommand(args);
    case "approve":
      return approveCommand(args);
    case "context":
      return contextCommand(args);
    case "task":
      return taskCommand(args);
    case "route":
      return routeCommand(args);
    case "knowledge":
      return knowledgeCommand(args);
    case "verify":
      return verifyCommand(args);
    case "quick":
      return quickCommand(args);
    case "status":
      return statusCommand(args);
    case "doctor":
      return doctorCommand(args);
    case "eval":
      return evalCommand(args);
    case "skills":
      return skillsCommand(args);
    case "adapters":
      return adaptersCommand(args);
    case "diff":
      return diffCommand(args);
    case "admin":
      throw new Error("Usage: spectra admin <approve|eval|diff|adapters|doctor|skills|quick> [options]");
    case "spec":
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

export { dispatch, main, normalizeCommand };
