import { buildRoute } from "../lib/business-context.js";
import { parseOptions } from "../lib/options.js";
import { title } from "../lib/output.js";

function splitCsv(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function routeCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help"],
    stringFlags: ["--cwd", "--domain", "--format", "--module", "--task"]
  });
  if (options["--help"]) {
    title("Usage: spectra route --task <description> [--domain <csv>] [--module <csv>] [--cwd <path>] [--format <refs|json>]");
    return 0;
  }
  if (!options["--task"]) {
    throw new Error("--task is required.");
  }
  const route = buildRoute({
    cwd: options["--cwd"] ?? process.cwd(),
    task: options["--task"],
    domains: splitCsv(options["--domain"]),
    modules: splitCsv(options["--module"])
  });
  if ((options["--format"] ?? "refs") === "json") {
    process.stdout.write(`${JSON.stringify(route)}\n`);
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
