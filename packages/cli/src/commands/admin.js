import { adaptersGenerateCommand } from "./adapters-generate.js";
import { approveCommand } from "./approve.js";
import { doctorCommand } from "./doctor.js";
import { evalRunCommand } from "./eval-run.js";
import { quickCommand } from "./quick.js";
import { skillsResolveCommand } from "./skills-resolve.js";
import { specDiffCommand } from "./spec-diff.js";

function adminCommand(subcommand, argv) {
  switch (subcommand) {
    case "approve": return approveCommand(argv);
    case "eval": return evalRunCommand(argv);
    case "diff": return specDiffCommand(argv);
    case "adapters": return adaptersGenerateCommand(argv);
    case "doctor": return doctorCommand(argv);
    case "skills": return skillsResolveCommand(argv);
    case "quick": return quickCommand(argv);
    default: throw new Error("Usage: spectra admin <approve|eval|diff|adapters|doctor|skills|quick> [options]");
  }
}

export { adminCommand };
