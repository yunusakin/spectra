import fs from "node:fs";
import path from "node:path";
import { normalize, parseRuleStatement, rowValue, splitList, splitRawList } from "./parser.js";
import { getBusinessPaths, readMarkdownTable, resolveBusinessPath } from "./repository.js";

function validateKeywords({ row, domain, keywordOwners, errors }) {
  if (!("keywords" in row)) return;
  const keywordCell = rowValue(row, "keywords");
  if (String(keywordCell).trim() === "") return;
  const rawKeywords = splitRawList(keywordCell);
  const normalizedKeywords = rawKeywords.map(normalize);
  const seen = new Set();
  rawKeywords.forEach((rawKeyword, index) => {
    if (/[;/]/.test(rawKeyword)) {
      errors.push(`Business domain '${domain}' contains invalid routing keyword delimiter in '${rawKeyword}'. Use commas between keywords.`);
    }
    const keyword = normalizedKeywords[index];
    if (!keyword) {
      errors.push(`Business domain '${domain}' contains an empty routing keyword.`);
      return;
    }
    if (seen.has(keyword)) {
      errors.push(`Business domain '${domain}' contains duplicate routing keyword '${keyword}'.`);
      return;
    }
    seen.add(keyword);
    const owner = keywordOwners.get(keyword);
    if (owner && owner !== domain) {
      errors.push(`Business domains '${owner}' and '${domain}' contain ambiguous routing keyword '${keyword}'.`);
      return;
    }
    keywordOwners.set(keyword, domain);
  });
}

function validateBusinessContext(repoRoot) {
  const { businessRoot, businessIndexPath, moduleIndexPath } = getBusinessPaths(repoRoot);
  const errors = [];
  const ids = new Set();
  for (const filePath of [moduleIndexPath, businessIndexPath]) {
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing canonical business context file: ${path.relative(path.join(repoRoot, "spectra"), filePath)}`);
    }
  }
  if (errors.length > 0) return errors;
  const domainRows = readMarkdownTable(businessIndexPath);
  const moduleRows = readMarkdownTable(moduleIndexPath);
  const domains = new Set();
  const modules = new Set(moduleRows.map((row) => normalize(rowValue(row, "module"))).filter(Boolean));
  const activeStatements = new Map();
  const keywordOwners = new Map();

  for (const row of domainRows) {
    const domain = normalize(rowValue(row, "domain"));
    if (domain) {
      if (domains.has(domain)) errors.push(`Duplicate business domain in index: ${domain}`);
      domains.add(domain);
      validateKeywords({ row, domain, keywordOwners, errors });
    }
  }

  for (const row of moduleRows) {
    const module = normalize(rowValue(row, "module"));
    if (!module) continue;
    for (const domain of splitList(rowValue(row, "business-domains"))) {
      if (!domains.has(domain)) errors.push(`Technical module '${module}' references unknown business domain: ${domain}`);
    }
  }

  for (const entry of fs.existsSync(businessRoot) ? fs.readdirSync(businessRoot, { withFileTypes: true }) : []) {
    if (entry.isDirectory() && !domains.has(normalize(entry.name))) {
      errors.push(`Business domain folder is not listed in INDEX.md: ${entry.name}`);
    }
  }

  for (const row of domainRows) {
    if (!rowValue(row, "domain") || !rowValue(row, "rules") || !rowValue(row, "unresolved")) {
      errors.push("Business domain index rows require Domain, Rules, and Unresolved paths.");
      continue;
    }
    const domain = normalize(rowValue(row, "domain"));
    for (const module of splitList(rowValue(row, "related-modules"))) {
      if (modules.size > 0 && !modules.has(module)) errors.push(`Business domain '${domain}' references unknown technical module: ${module}`);
    }
    for (const relativePath of [rowValue(row, "rules"), rowValue(row, "unresolved")]) {
      let filePath;
      try {
        filePath = resolveBusinessPath(businessRoot, relativePath);
      } catch {
        errors.push(`Business domain '${rowValue(row, "domain")}' references a path outside business memory: ${relativePath}`);
        continue;
      }
      if (!fs.existsSync(filePath)) {
        errors.push(`Business domain '${rowValue(row, "domain")}' references missing file: ${relativePath}`);
        continue;
      }
      const content = fs.readFileSync(filePath, "utf8");
      const sections = content.split(/^##\s+/m).slice(1);
      for (const section of sections) {
        const [heading, ...body] = section.split("\n");
        const rule = heading.match(/^(RULE-[A-Z0-9-]+)\s+—\s+.+$/);
        if (!rule) {
          errors.push(`Malformed business rule heading in ${relativePath}: ${heading}`);
          continue;
        }
        const statuses = body.join("\n").match(/^Status:\s+(\S+)\s*$/gm) ?? [];
        if (statuses.length !== 1) {
          errors.push(`Business rule ${rule[1]} must contain exactly one valid Status line.`);
          continue;
        }
        const status = statuses[0].replace(/^Status:\s+/, "").trim();
        if (ids.has(rule[1])) errors.push(`Duplicate business rule ID: ${rule[1]}`);
        ids.add(rule[1]);
        if (!["active", "unresolved", "superseded", "deprecated"].includes(status)) errors.push(`Invalid business-rule status for ${rule[1]}: ${status}`);
        const fileName = path.basename(relativePath);
        if (fileName === "rules.md" && status === "unresolved") errors.push(`Business rule ${rule[1]} cannot be unresolved in rules.md.`);
        if (fileName === "unresolved.md" && status !== "unresolved") errors.push(`Business rule ${rule[1]} must be unresolved in unresolved.md.`);
        if (status === "active") {
          const statement = normalize(parseRuleStatement(body.join("\n")));
          if (statement) {
            const statementKey = `${domain}:${statement}`;
            if (activeStatements.has(statementKey)) {
              errors.push(`Duplicate active business-rule statement: ${activeStatements.get(statementKey)} and ${rule[1]}`);
            } else {
              activeStatements.set(statementKey, rule[1]);
            }
          }
        }
      }
    }
  }
  return errors;
}

export { validateBusinessContext };
