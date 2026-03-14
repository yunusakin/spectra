import { adoptCommand } from "./commands/adopt.js";
import { adaptersGenerateCommand } from "./commands/adapters-generate.js";
import { approveCommand } from "./commands/approve.js";
import { contextPackCommand } from "./commands/context-pack.js";
import { doctorCommand } from "./commands/doctor.js";
import { discussTaskCommand } from "./commands/discuss-task.js";
import { evalRunCommand } from "./commands/eval-run.js";
import { initCommand } from "./commands/init.js";
import { quickCommand } from "./commands/quick.js";
import { specDiffCommand } from "./commands/spec-diff.js";
import { skillsResolveCommand } from "./commands/skills-resolve.js";
import { statusCommand } from "./commands/status.js";
import { validateCommand } from "./commands/validate.js";
import { verifyCommand } from "./commands/verify.js";
import { fail, title } from "./lib/output.js";

function printHelp() {
  title("Spectra CLI");
  title("");
  title("Usage:");
  title("  spectra <command> [options]");
  title("");
  title("Setup:");
  title("  init [path]                Bootstrap a new Spectra project");
  title("  adopt [path]               Add Spectra to an existing repo");
  title("");
  title("Workflow:");
  title("  ctx                        Print a role/goal-aware context pack");
  title("  task                       Create an implementation brief");
  title("  ap                         Advance the staged approval state");
  title("  val                        Run validation and policy checks");
  title("  ver                        Run release confidence verification");
  title("  st                         Show repo health plus staged approval status");
  title("  doc                        Check environment and local runtime health");
  title("  q                          Run the non-app quick lane");
  title("  skills                     Resolve or validate skill order");
  title("  eval                       Run contract-driven eval suites");
  title("");
  title("Utilities:");
  title("  adapters                   Generate AI tool adapters");
  title("  diff <init|update|semantic>  Run spec diff reporting");
  title("");
  title("Short forms are the default UX.");
}

function normalizeCommand(command, subcommand, ...rest) {
  switch (command) {
    case "ctx":
      return { command: "context-pack", subcommand, rest };
    case "task":
      return { command: "discuss-task", subcommand, rest };
    case "ap":
      return { command: "approve", subcommand, rest };
    case "val":
      return { command: "validate", subcommand, rest };
    case "ver":
      return { command: "verify", subcommand, rest };
    case "st":
      return { command: "status", subcommand, rest };
    case "doc":
      return { command: "doctor", subcommand, rest };
    case "q":
      return { command: "quick", subcommand, rest };
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
      printHelp();
      return 0;
    case "--version":
    case "version":
      title("spectra 0.1.0");
      return 0;
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

function main(argv) {
  try {
    const status = dispatch(argv);
    process.exit(status);
  } catch (error) {
    fail(error.message);
    process.exit(1);
  }
}

export { main };
