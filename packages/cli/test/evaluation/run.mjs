#!/usr/bin/env node
// Prints the evaluation report and timings; `--write` refreshes baseline.json and REPORT.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCorpus, runCorpus, snapshot } from "./runner.js";
import { renderReport } from "./report.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const corpus = loadCorpus();
const results = runCorpus(corpus);
const report = renderReport(results, corpus);
if (process.argv.includes("--write")) {
  fs.writeFileSync(path.join(dir, "baseline.json"), `${JSON.stringify(snapshot(results), null, 2)}\n`);
  fs.writeFileSync(path.join(dir, "REPORT.md"), report);
}
process.stdout.write(report);
const sorted = [...results.perf.resolveMs].sort((a, b) => a - b);
process.stdout.write(`\nTimings (not stored): cold first resolution ${JSON.stringify(results.perf.coldMs)} ms; warm resolutions n=${sorted.length} median=${sorted[Math.floor(sorted.length / 2)]} ms max=${sorted.at(-1)} ms\n`);
