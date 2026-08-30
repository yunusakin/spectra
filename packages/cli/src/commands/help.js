import { title } from "../lib/output.js";
import { findSpectraRoot, getInstalledProfile } from "../lib/runtime.js";

const COMMANDS = {
  init: "Create a new Spectra project",
  adopt: "Add Spectra to an existing project",
  update: "Update Spectra and the project runtime",
  upgrade: "Change the installed Lite or Full profile",
  route: "Route a task to the smallest relevant business and module context",
  knowledge: "Record and promote durable business rules",
  context: "Load project context",
  task: "Prepare an implementation task",
  check: "Validate project health",
  status: "Show project status"
};

function printHelp(command = null, cwd = process.cwd()) {
  if (command === "advanced") {
    title("Spectra advanced commands");
    title("");
    title("  spectra admin approve    Advance staged approval state");
    title("  spectra admin eval       Run contract-driven evaluation suites");
    title("  spectra admin diff       Report specification changes");
    title("  spectra admin doctor     Check local runtime and adapter health");
    title("  spectra admin skills     Resolve skill order");
    title("  spectra admin adapters   Generate AI-tool adapters");
    title("  spectra admin quick      Run a focused non-app task lane");
    return 0;
  }

  if (command && COMMANDS[command]) {
    title(`spectra ${command}`);
    title("");
    title(COMMANDS[command]);
    title("");
    title(`Run \`spectra ${command} --help\` for command options.`);
    return 0;
  }

  title("Spectra — Spec-Driven Development");
  const projectRoot = findSpectraRoot(cwd);
  const profile = projectRoot ? getInstalledProfile(projectRoot) : null;
  if (profile) {
    title(`Profile: ${profile}`);
  }
  title("");
  title("Common workflow:");
  for (const [name, description] of Object.entries(COMMANDS)) {
    title(`  spectra ${name.padEnd(9)} ${description}`);
  }
  title("");
  title("Run `spectra help <command>` for details.");
  if (profile === "full") {
    title("Full profile: run `spectra help advanced` for advanced commands.");
  } else if (!profile) {
    title("Run `spectra help advanced` for advanced commands.");
  }
  return 0;
}

export { printHelp };
