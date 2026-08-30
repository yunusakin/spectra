import { addBusinessRule, promoteBusinessRule } from "../lib/business-context.js";
import { parseOptions } from "../lib/options.js";
import { ok, title } from "../lib/output.js";

function knowledgeCommand(argv) {
  const [action, ...rest] = argv;
  const { options } = parseOptions(rest, {
    booleanFlags: ["--help"],
    stringFlags: ["--confidence", "--cwd", "--domain", "--evidence", "--id", "--modules", "--statement", "--status", "--title"]
  });
  if (options["--help"] || !action) {
    title("Usage: spectra knowledge <add|promote> [options]");
    return 0;
  }
  if (action === "add") {
    for (const flag of ["--domain", "--title", "--statement"]) if (!options[flag]) throw new Error(`${flag} is required.`);
    const result = addBusinessRule({ cwd: options["--cwd"] ?? process.cwd(), domain: options["--domain"], title: options["--title"], statement: options["--statement"], status: options["--status"] ?? "unresolved", evidence: options["--evidence"], modules: options["--modules"], confidence: options["--confidence"] });
    ok(`Business rule recorded: ${result.id} (${result.status})`);
    return 0;
  }
  if (action === "promote") {
    if (!options["--id"]) throw new Error("--id is required.");
    const result = promoteBusinessRule({ cwd: options["--cwd"] ?? process.cwd(), id: options["--id"] });
    ok(`Business rule promoted: ${result.id} (${result.domain})`);
    return 0;
  }
  throw new Error("Usage: spectra knowledge <add|promote> [options]");
}

export { knowledgeCommand };
