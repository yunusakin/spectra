import fs from "node:fs";
import path from "node:path";
import { getSddRoot } from "../project-layout.js";
import { normalize } from "../business/parser.js";

// An existing module index is reviewed project intelligence: keep every row (and any edit) and only add modules the
// manifests now show that no row names or covers by path. A bootstrap placeholder row is dropped once a real one is added.
function mergeModuleRows(existing, detected) {
  const lines = existing.split(/\r?\n/);
  const cells = line => line.split("|").slice(1, -1).map(cell => cell.trim());
  const isRow = line => /^\|/.test(line) && !/^\|\s*-/.test(line) && cells(line)[0] !== "Module";
  const rowLines = lines.filter(isRow);
  const names = new Set(rowLines.map(line => normalize(cells(line)[0])));
  const covered = new Set(rowLines.flatMap(line => (cells(line)[2] ?? "").split(",").map(value => value.trim()).filter(Boolean)));
  const additions = detected.filter(row => !names.has(normalize(row.name)) && !row.paths.split(",").map(value => value.trim()).some(value => covered.has(value)));
  if (additions.length === 0) return existing;
  const kept = lines.filter(line => !(isRow(line) && /^\(none\)$/.test(cells(line)[0])));
  let last = kept.length - 1;
  while (last >= 0 && kept[last].trim() === "") last--;
  const lastRow = kept.map((line, index) => (/^\|/.test(line) ? index : -1)).filter(index => index >= 0).pop() ?? last;
  kept.splice(lastRow + 1, 0, ...additions.map(row => row.line));
  return `${kept.join("\n").replace(/\n*$/, "")}\n`;
}

// Discovery is a human-review projection of the existing index, not another
// scanner. Manifest declarations prove structure, not business responsibility.
function enrichDiscovery(repoRoot, index, { preserveReviewed = false } = {}) {
  const memory = path.join(getSddRoot(repoRoot), "memory-bank");
  const append = (name, heading, lines, missing) => fs.appendFileSync(
    path.join(memory, "discovery", `${name}.md`),
    `\n## ${heading}\n\n> Unconfirmed interpretation of repository evidence; review before relying on it.\n\n${lines.length ? lines.join("\n") : `- ${missing}`}\n`
  );
  if (!index) {
    append("architecture", "Repository Index Evidence", [], "Repository index unavailable: indexing failed. Review manifests manually.");
    return;
  }
  const text = value => String(value ?? "").replace(/[\r\n|`]/g, " ");
  const evidence = record => record.evidence.map(item => `${text(item.file)}${item.field ? ` (${text(item.field)})` : ""}`).join(", ");
  const describe = record => `- ${text(record.name)} — ${text(record.path ?? record.ecosystem)} [${record.status}, confidence=${record.confidence}]; evidence: ${evidence(record)}`;
  const modules = index.records.filter(record => record.kind === "module");
  const architecture = [];
  for (const record of modules) {
    architecture.push(describe(record));
    for (const [kind, source] of Object.entries(record.attributes.sourceRoots ?? {})) {
      const exists = fs.existsSync(path.join(repoRoot, source.path));
      architecture.push(`  - ${text(kind)} source root: ${text(source.path)} [${source.status}, confidence=${source.confidence}; ${exists ? "exists" : "not found"}]; manifest: ${evidence(record)}`);
    }
    for (const dir of ["src", "lib", "cmd", "internal"]) {
      const relative = path.posix.join(record.path ?? ".", dir);
      if (fs.existsSync(path.join(repoRoot, relative))) architecture.push(`  - Source/layout directory exists: ${text(relative)}; responsibility unconfirmed.`);
    }
  }
  architecture.push(...index.records.filter(record => ["runtime", "entrypoint"].includes(record.kind)).map(describe));
  append("architecture", "Repository Index Evidence", architecture, "No supported module/runtime signals detected by the repository index.");
  append("structure", "Manifest Modules", modules.map(describe), "No supported manifest module signals detected.");
  append("stack", "Indexed Ecosystems and Runtime", [
    ...index.ecosystems.map(eco => `- Ecosystem: ${eco}`),
    ...index.records.filter(record => record.kind === "runtime").map(describe)
  ], "No supported ecosystem signals detected by the repository index.");

  const testLines = index.records.filter(record => record.kind === "test-target").flatMap(record => {
    const lines = [describe(record)];
    if (record.attributes.command) lines.push(`  - Declared test command (not executed): ${text(record.attributes.command)}`);
    else if (record.ecosystem === "maven") lines.push("  - Conventional test command (not executed; confirm project configuration): mvn test");
    return lines;
  });
  const testTools = /junit|testng|pytest|vitest|jest|mocha|jasmine|playwright|cypress|xunit|nunit|mstest/i;
  testLines.push(...index.records.filter(record => record.kind === "dependency" && testTools.test(record.name)).map(record => `- Declared test-tool dependency (usage unconfirmed): ${text(record.name)}; evidence: ${evidence(record)}`));
  testLines.push("- Coverage: not measured. Test commands and tool dependencies do not prove passing tests or coverage.");
  if (!index.records.some(record => record.kind === "test-target")) testLines.unshift("- No supported manifest test-target signals detected.");
  append("testing", "Manifest Test Evidence", testLines, "No supported manifest test signals detected.");

  const conventionLines = modules.flatMap(record => Object.entries(record.attributes.scripts ?? {})
    .filter(([name]) => /lint|format|style|typecheck/i.test(name))
    .map(([name, command]) => `- ${text(name)} command (not executed): ${text(command)}; module: ${text(record.path)}; evidence: ${evidence(record)}`));
  append("conventions", "Declared Tooling", conventionLines, "No supported convention command signals detected. Coding practices require review.");
  if (modules.length) {
    const rows = new Map();
    for (const record of modules) {
      const name = normalize(record.path === "." ? record.name : record.path) || normalize(path.basename(repoRoot)) || "root";
      const previous = rows.get(name);
      const paths = [previous?.paths, text(record.path)].filter(Boolean).join(", ");
      rows.set(name, { paths, evidence: evidence(record) });
    }
    const modulesPath = path.join(memory, "tech", "modules.md");
    const detected = [...rows].map(([name, item]) => ({ name, paths: item.paths, line: `| ${name} | Manifest module; responsibility unconfirmed (${item.evidence}) | ${item.paths} | |` }));
    if (preserveReviewed && fs.existsSync(modulesPath)) fs.writeFileSync(modulesPath, mergeModuleRows(fs.readFileSync(modulesPath, "utf8"), detected));
    else fs.writeFileSync(modulesPath, `# Technical Module Index\n\n> Unconfirmed bootstrap map from repository manifests. Review responsibilities and domain mappings.\n\n| Module | Responsibility | Paths | Business Domains |\n| --- | --- | --- | --- |\n${detected.map(row => row.line).join("\n")}\n`);
  }
}

export { enrichDiscovery };
