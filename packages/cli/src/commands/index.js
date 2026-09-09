import { findSpectraRoot } from "../lib/runtime.js";
import { parseOptions } from "../lib/options.js";
import { fail, ok, title, warn } from "../lib/output.js";
import { buildRepoIndex } from "../lib/index/engine.js";
import { writeIndex, readIndex, getIndexFilePath } from "../lib/index/cache.js";

function resolveRepoRoot(cwd) {
  return findSpectraRoot(cwd) ?? cwd;
}

function printSummaryText(index) {
  title("Spectra repo index");
  title(`Ecosystems: ${index.ecosystems.length > 0 ? index.ecosystems.join(", ") : "none detected"}`);
  title(`Records: ${index.stats.total} (confirmed: ${index.stats.byStatus.confirmed}, candidate: ${index.stats.byStatus.candidate})`);
  title(`Confidence: high=${index.stats.byConfidence.high} medium=${index.stats.byConfidence.medium} low=${index.stats.byConfidence.low}`);
  const kinds = Object.entries(index.stats.byKind).sort(([a], [b]) => a.localeCompare(b));
  for (const [kind, count] of kinds) {
    title(`  - ${kind}: ${count}`);
  }
}

function printExplain(index) {
  title("");
  title("Evidence trail:");
  for (const record of index.records) {
    const evidenceText = record.evidence.map((e) => (e.field ? `${e.file}#${e.field}` : e.file)).join(", ");
    title(`  [${record.status}/${record.confidence}] ${record.kind} "${record.name}" (${record.ecosystem}) <- ${evidenceText}`);
  }
}

async function indexCommand(argv) {
  const { options } = parseOptions(argv, {
    booleanFlags: ["--help", "--check", "--explain"],
    stringFlags: ["--format", "--cwd"]
  });

  if (options["--help"]) {
    title("Usage: spectra index [--check] [--explain] [--format <text|json>] [--cwd <path>]");
    return 0;
  }

  const format = options["--format"] ?? "text";
  if (format !== "text" && format !== "json") {
    throw new Error(`Unsupported --format: ${format}. Use "text" or "json".`);
  }

  const cwd = options["--cwd"] ?? process.cwd();
  const repoRoot = resolveRepoRoot(cwd);
  const index = buildRepoIndex(repoRoot);

  if (options["--check"]) {
    const existing = readIndex(repoRoot);
    if (!existing) {
      if (format === "json") {
        process.stdout.write(`${JSON.stringify({ status: "missing", indexPath: getIndexFilePath(repoRoot) })}\n`);
      } else {
        fail(`No index found. Run "spectra index" first (expected at ${getIndexFilePath(repoRoot)}).`);
      }
      return 1;
    }

    const stale = existing.signature.hash !== index.signature.hash || existing.ecosystems.join(",") !== index.ecosystems.join(",");
    if (stale) {
      if (format === "json") {
        process.stdout.write(
          `${JSON.stringify({ status: "stale", storedSignature: existing.signature, currentSignature: index.signature })}\n`
        );
      } else {
        fail("Repo index is stale. Run \"spectra index\" to refresh it.");
        if (options["--explain"]) {
          printExplain(index);
        }
      }
      return 1;
    }

    if (format === "json") {
      process.stdout.write(`${JSON.stringify({ status: "up-to-date", signature: existing.signature })}\n`);
    } else {
      ok("Repo index is up to date.");
    }
    return 0;
  }

  const filePath = writeIndex(repoRoot, index);

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(index)}\n`);
  } else {
    printSummaryText(index);
    if (options["--explain"]) {
      printExplain(index);
    }
    title("");
    ok(`Wrote ${filePath}`);
  }

  if (index.ecosystems.length === 0) {
    warn("No recognized ecosystem manifests were found; index contains only a low-confidence project record.");
  }

  return 0;
}

export { indexCommand };
