import { buildRoute } from "../lib/business-context.js";
import { parseOptions } from "../lib/options.js";
import { title } from "../lib/output.js";
import { ContractError, guardJson, parseArguments, portableRoot, versioned } from "../lib/contract.js";

function splitCsv(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function routeCommand(argv) {
  return guardJson(argv, () => runRoute(argv));
}

function runRoute(argv) {
  const { options } = parseArguments(() => parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--domain", "--format", "--module", "--task"]
  }));
  if (options["--help"]) {
    title("Usage: spectra route --task <description> [--domain <csv>] [--module <csv>] [--cwd <path>] [--format <refs|json>]");
    return 0;
  }
  if (!options["--task"]) {
    throw new ContractError("invalid-arguments", "--task is required.");
  }
  const route = buildRoute({
    cwd: options["--cwd"] ?? process.cwd(),
    task: options["--task"],
    domains: splitCsv(options["--domain"]),
    modules: splitCsv(options["--module"])
  });
  if ((options["--format"] ?? "refs") === "json") {
    process.stdout.write(`${JSON.stringify(versioned({ ...route, repoRoot: portableRoot(options["--cwd"] ?? process.cwd(), route.repoRoot) }))}\n`);
    return 0;
  }
  title(`Spectra Route: ${route.classification}`);
  for (const entry of route.entries) title(`- ${entry.path} (${entry.reason})`);
  if (route.deferred.length > 0) {
    title("Deferred:");
    for (const deferred of route.deferred) title(`- ${deferred}`);
  }
  return 0;
}

export { routeCommand };
