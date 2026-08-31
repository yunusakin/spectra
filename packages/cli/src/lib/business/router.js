import { normalize, rowValue, splitList, taskContainsNormalized, taskTokens } from "./parser.js";
import { getContextRoot, readBusinessIndexes, requireProjectRoot, resolveBusinessPath } from "./repository.js";

function classifyRoute({ domains, modules }) {
  if (domains.length > 0 && modules.length > 0) return "mixed";
  if (domains.length > 0) return "business";
  return "technical";
}

function addMatch(matches, row, key, matchedBy, matchedValue = null) {
  const name = normalize(rowValue(row, key));
  if (!name || matches.has(name)) return false;
  matches.set(name, { name, matchedBy, matchedValue: matchedValue ? normalize(matchedValue) : name });
  return true;
}

function buildRoute({ cwd, task, domains = [], modules = [] }) {
  const projectRoot = requireProjectRoot(cwd);
  const root = getContextRoot(projectRoot);
  const { businessRoot, domainRows, moduleRows } = readBusinessIndexes(projectRoot);
  const tokens = taskTokens(task);
  const explicitDomains = new Set(domains.map(normalize));
  const explicitModules = new Set(modules.map(normalize));
  const knownDomains = new Set(domainRows.map((row) => normalize(rowValue(row, "domain"))).filter(Boolean));
  const knownModules = new Set(moduleRows.map((row) => normalize(rowValue(row, "module"))).filter(Boolean));
  const domainMatches = new Map();
  const moduleMatches = new Map();

  for (const domain of explicitDomains) {
    if (!knownDomains.has(domain)) throw new Error(`Unknown business domain: ${domain}`);
  }
  for (const module of explicitModules) {
    if (!knownModules.has(module)) throw new Error(`Unknown technical module: ${module}`);
  }

  for (const row of domainRows) {
    const domain = normalize(rowValue(row, "domain"));
    if (explicitDomains.has(domain)) addMatch(domainMatches, row, "domain", "explicit-domain", domain);
  }
  for (const row of moduleRows) {
    const module = normalize(rowValue(row, "module"));
    if (explicitModules.has(module)) addMatch(moduleMatches, row, "module", "explicit-module", module);
  }
  for (const row of domainRows) {
    const domain = normalize(rowValue(row, "domain"));
    if (taskContainsNormalized(tokens, domain)) addMatch(domainMatches, row, "domain", "domain", domain);
  }
  for (const row of moduleRows) {
    const module = normalize(rowValue(row, "module"));
    if (taskContainsNormalized(tokens, module)) addMatch(moduleMatches, row, "module", "module", module);
  }
  for (const row of domainRows) {
    for (const keyword of splitList(rowValue(row, "keywords"))) {
      if (taskContainsNormalized(tokens, keyword)) {
        addMatch(domainMatches, row, "domain", "keyword", keyword);
        break;
      }
    }
  }
  for (const row of moduleRows) {
    const module = normalize(rowValue(row, "module"));
    if (!moduleMatches.has(module)) continue;
    for (const domain of splitList(rowValue(row, "business-domains"))) {
      const domainRow = domainRows.find((candidate) => normalize(rowValue(candidate, "domain")) === domain);
      if (domainRow) addMatch(domainMatches, domainRow, "domain", "module-business-domain", module);
    }
  }
  for (const row of domainRows) {
    const domain = normalize(rowValue(row, "domain"));
    if (!domainMatches.has(domain)) continue;
    for (const module of splitList(rowValue(row, "related-modules"))) {
      const moduleRow = moduleRows.find((candidate) => normalize(rowValue(candidate, "module")) === module);
      if (moduleRow) addMatch(moduleMatches, moduleRow, "module", "business-related-module", domain);
    }
  }
  const selectedDomainNames = new Set(domainMatches.keys());
  const selectedModuleNames = new Set(moduleMatches.keys());
  const entries = [
    { path: "sdd/system/runtime/minimal.md", mode: "full", reason: "routing policy" },
    { path: "sdd/memory-bank/tech/modules.md", mode: "full", reason: "module index" },
    { path: "sdd/memory-bank/business/INDEX.md", mode: "full", reason: "domain index" }
  ];
  const deferred = [];

  for (const row of domainRows) {
    const selected = selectedDomainNames.has(normalize(rowValue(row, "domain")));
    for (const rulePath of [rowValue(row, "rules"), rowValue(row, "unresolved")].filter(Boolean)) {
      resolveBusinessPath(businessRoot, rulePath);
      const normalizedPath = `sdd/memory-bank/${rulePath.replace(/^sdd\/memory-bank\//, "")}`;
      if (selected) {
        entries.push({ path: normalizedPath, mode: "full", reason: `domain: ${rowValue(row, "domain")}` });
      } else {
        deferred.push(normalizedPath);
      }
    }
  }

  return {
    repoRoot: root,
    task,
    classification: classifyRoute({ domains: [...selectedDomainNames], modules: [...selectedModuleNames] }),
    domains: [...selectedDomainNames],
    modules: [...selectedModuleNames],
    domainMatches: [...domainMatches.values()],
    moduleMatches: [...moduleMatches.values()],
    entries,
    deferred
  };
}

export { buildRoute };
