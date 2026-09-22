import { title } from "../lib/output.js";
import { findSpectraRoot, getInstalledProfile } from "../lib/runtime.js";

// Canonical public vocabulary grouped by user workflow. Compatibility
// aliases (context-pack, discuss-task, eval run, skills resolve,
// adapters generate, spec diff, admin <command>) are routed in main.js
// and intentionally not taught here: help should present one canonical
// vocabulary, not a flat mix of core, advanced, and legacy forms.
const WORKFLOWS = [
  ["Getting started", [
    ["init", "Create a new Spectra project"],
    ["adopt", "Add Spectra to an existing project"],
    ["onboard", "Fill in projectbrief.md interactively"]
  ]],
  ["Context and knowledge", [
    ["context", "Load project context"],
    ["task", "Prepare an implementation task"],
    ["route", "Route a task to the smallest relevant context"],
    ["knowledge", "Record and promote durable business rules"],
    ["index", "Build the deterministic repo index used for scoped context"]
  ]],
  ["Quality", [
    ["check", "Validate project health"],
    ["verify", "Aggregate checks into release-confidence status"],
    ["status", "Show project status"]
  ]],
  ["Maintenance", [
    ["update", "Update Spectra and the project runtime"],
    ["upgrade", "Change the installed Lite or Full profile"],
    ["doctor", "Check local tools, runtime, and adapters"]
  ]]
];

// Advanced commands are top-level too; `spectra admin <command>` remains
// a compatibility alias for them.
const ADVANCED = [
  ["approve", "Advance staged approval state"],
  ["eval", "Run contract-driven evaluation suites"],
  ["diff", "Report specification changes"],
  ["quick", "Run a focused non-app task lane"],
  ["skills", "Resolve skill order"],
  ["adapters", "Generate AI-tool adapters"]
];

// Descriptions available to `spectra help <command>` (canonical only).
const DESCRIPTIONS = new Map();
for (const [, commands] of WORKFLOWS) {
  for (const [name, description] of commands) {
    DESCRIPTIONS.set(name, description);
  }
}
for (const [name, description] of ADVANCED) {
  DESCRIPTIONS.set(name, description);
}

function printCommandEntries(commands) {
  for (const [name, description] of commands) {
    title(`  spectra ${name.padEnd(10)}${description}`);
  }
}

function printHelp(command = null, cwd = process.cwd()) {
  if (command === "advanced") {
    title("Spectra advanced commands");
    title("");
    printCommandEntries(ADVANCED);
    title("");
    title("`spectra admin <command>` remains available as an alias for these commands.");
    return 0;
  }

  if (command && DESCRIPTIONS.has(command)) {
    title(`spectra ${command}`);
    title("");
    title(DESCRIPTIONS.get(command));
    title("");
    title(`Run \`spectra ${command} --help\` for command options.`);
    return 0;
  }

  title("Spectra — AI-assisted development context");
  const projectRoot = findSpectraRoot(cwd);
  const profile = projectRoot ? getInstalledProfile(projectRoot) : null;
  if (profile) {
    title(`Profile: ${profile}`);
  }
  for (const [group, commands] of WORKFLOWS) {
    title("");
    title(`${group}:`);
    printCommandEntries(commands);
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
