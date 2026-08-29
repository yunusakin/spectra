import fs from "node:fs";
import path from "node:path";
import { findSpectraRoot } from "./runtime.js";

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((value) => value.trim());
}

function readMarkdownTable(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  if (lines.length < 2) {
    return [];
  }
  const headers = splitTableRow(lines[0]).map(normalize);
  return lines.slice(1).reduce((rows, line) => {
    const cells = splitTableRow(line);
    if (cells.every((value) => /^:?-{3,}:?$/.test(value))) {
      return rows;
    }
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
    return rows;
  }, []);
}

function getContextRoot(projectRoot) {
  return path.join(projectRoot, "spectra");
}

function classifyRoute({ domains, modules }) {
  if (domains.length > 0 && modules.length > 0) return "mixed";
  if (domains.length > 0) return "business";
  return "technical";
}

function buildRoute({ cwd, task, domains = [], modules = [] }) {
  const projectRoot = findSpectraRoot(cwd);
  if (!projectRoot) {
    throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  }
  const root = getContextRoot(projectRoot);
  const memoryRoot = path.join(root, "sdd", "memory-bank");
  const businessIndexPath = path.join(memoryRoot, "business", "INDEX.md");
  const moduleIndexPath = path.join(memoryRoot, "tech", "modules.md");
  const domainRows = readMarkdownTable(businessIndexPath);
  const moduleRows = readMarkdownTable(moduleIndexPath);
  const taskTerms = normalize(task).split("-").filter((term) => term.length > 2);
  const explicitDomains = new Set(domains.map(normalize));
  const explicitModules = new Set(modules.map(normalize));

  const selectedDomains = domainRows.filter((row) => {
    const domain = normalize(row.domain);
    return explicitDomains.has(domain) || taskTerms.includes(domain);
  });
  const selectedModules = moduleRows.filter((row) => {
    const module = normalize(row.module);
    return explicitModules.has(module) || taskTerms.includes(module);
  });

  const entries = [
    { path: "sdd/system/runtime/minimal.md", mode: "full", reason: "routing policy" },
    { path: "sdd/memory-bank/tech/modules.md", mode: "full", reason: "module index" },
    { path: "sdd/memory-bank/business/INDEX.md", mode: "full", reason: "domain index" }
  ];
  const deferred = [];

  for (const row of domainRows) {
    const selected = selectedDomains.includes(row);
    for (const rulePath of [row.rules, row.unresolved].filter(Boolean)) {
      const normalizedPath = `sdd/memory-bank/${rulePath.replace(/^sdd\/memory-bank\//, "")}`;
      if (selected) {
        entries.push({ path: normalizedPath, mode: "full", reason: `domain: ${row.domain}` });
      } else {
        deferred.push(normalizedPath);
      }
    }
  }

  return {
    repoRoot: root,
    task,
    classification: classifyRoute({ domains: selectedDomains, modules: selectedModules }),
    domains: selectedDomains.map((row) => normalize(row.domain)),
    modules: selectedModules.map((row) => normalize(row.module)),
    entries,
    deferred
  };
}

function ruleFile(root, domain, status) {
  return path.join(root, "spectra", "sdd", "memory-bank", "business", normalize(domain), status === "active" ? "rules.md" : "unresolved.md");
}

function nextRuleId(root, domain) {
  const prefix = `RULE-${normalize(domain).slice(0, 3).toUpperCase()}-`;
  const files = [ruleFile(root, domain, "active"), ruleFile(root, domain, "unresolved")];
  const ids = files.flatMap((filePath) => fs.existsSync(filePath) ? [...fs.readFileSync(filePath, "utf8").matchAll(new RegExp(`${prefix}(\\d{3})`, "g"))].map((match) => Number(match[1])) : []);
  return `${prefix}${String((Math.max(0, ...ids) + 1)).padStart(3, "0")}`;
}

function ensureDomain(root, domain) {
  const normalized = normalize(domain);
  const businessRoot = path.join(root, "spectra", "sdd", "memory-bank", "business");
  const directory = path.join(businessRoot, normalized);
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, heading] of [["rules.md", "Business Rules"], ["unresolved.md", "Unresolved Business Rules"]]) {
    const filePath = path.join(directory, name);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, `# ${heading}: ${normalized}\n\n`);
  }
  const indexPath = path.join(businessRoot, "INDEX.md");
  const index = fs.readFileSync(indexPath, "utf8");
  if (!new RegExp(`\\|\\s*${normalized}\\s*\\|`, "i").test(index)) {
    fs.appendFileSync(indexPath, `| ${normalized} | business/${normalized}/rules.md | business/${normalized}/unresolved.md | |\n`);
  }
  return normalized;
}

function addBusinessRule({ cwd, domain, title, statement, status = "unresolved" }) {
  if (status !== "unresolved" && status !== "active") throw new Error("--status must be unresolved or active.");
  const root = findSpectraRoot(cwd);
  if (!root) throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  const normalizedDomain = ensureDomain(root, domain);
  const target = ruleFile(root, normalizedDomain, status);
  const content = fs.readFileSync(target, "utf8");
  if (content.includes(statement)) throw new Error("A matching business-rule statement already exists in this domain.");
  const id = nextRuleId(root, normalizedDomain);
  fs.appendFileSync(target, `\n## ${id} — ${title}\n\n${statement}\n\nStatus: ${status}\n\n`);
  return { id, domain: normalizedDomain, status };
}

function promoteBusinessRule({ cwd, id }) {
  const root = findSpectraRoot(cwd);
  if (!root) throw new Error(`Could not find a Spectra runtime from ${cwd}`);
  const businessRoot = path.join(root, "spectra", "sdd", "memory-bank", "business");
  for (const domain of fs.readdirSync(businessRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const unresolved = ruleFile(root, domain, "unresolved");
    if (!fs.existsSync(unresolved)) continue;
    const content = fs.readFileSync(unresolved, "utf8");
    const match = content.match(new RegExp(`\\n## ${id}[^]*?(?=\\n## |$)`));
    if (!match) continue;
    fs.writeFileSync(unresolved, content.replace(match[0], "\n"));
    fs.appendFileSync(ruleFile(root, domain, "active"), `${match[0].replace("Status: unresolved", "Status: active")}\n`);
    return { id, domain };
  }
  throw new Error(`Unresolved business rule not found: ${id}`);
}

export { addBusinessRule, buildRoute, normalize, promoteBusinessRule, readMarkdownTable };
