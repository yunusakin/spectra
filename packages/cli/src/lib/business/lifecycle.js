import fs from "node:fs";
import path from "node:path";
import { normalize, readMarkdownTableContent } from "./parser.js";
import { requireProjectRoot, ruleFile } from "./repository.js";

function nextRuleId(projectRoot, domain) {
  const prefix = `RULE-${normalize(domain).slice(0, 3).toUpperCase()}-`;
  const businessRoot = path.join(projectRoot, "spectra", "sdd", "memory-bank", "business");
  const files = fs.readdirSync(businessRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => [ruleFile(projectRoot, entry.name, "active"), ruleFile(projectRoot, entry.name, "unresolved")]);
  const ids = files.flatMap((filePath) =>
    fs.existsSync(filePath)
      ? [...fs.readFileSync(filePath, "utf8").matchAll(new RegExp(`${prefix}(\\d{3})`, "g"))].map((match) => Number(match[1]))
      : []
  );
  return `${prefix}${String(Math.max(0, ...ids) + 1).padStart(3, "0")}`;
}

function ensureDomain(projectRoot, domain) {
  const normalized = normalize(domain);
  const businessRoot = path.join(projectRoot, "spectra", "sdd", "memory-bank", "business");
  const directory = path.join(businessRoot, normalized);
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, heading] of [["rules.md", "Business Rules"], ["unresolved.md", "Unresolved Business Rules"]]) {
    const filePath = path.join(directory, name);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, `# ${heading}: ${normalized}\n\n`);
  }
  const indexPath = path.join(businessRoot, "INDEX.md");
  const index = fs.readFileSync(indexPath, "utf8");
  if (!new RegExp(`\\|\\s*${normalized}\\s*\\|`, "i").test(index)) {
    const firstRow = readMarkdownTableContent(index)[0] ?? {};
    const hasKeywords = Object.prototype.hasOwnProperty.call(firstRow, "keywords") || /^\s*\|[^|\n]*Domain[^|\n]*\|[^|\n]*Keywords[^|\n]*\|/im.test(index);
    const row = hasKeywords
      ? `| ${normalized} | | business/${normalized}/rules.md | business/${normalized}/unresolved.md | |\n`
      : `| ${normalized} | business/${normalized}/rules.md | business/${normalized}/unresolved.md | |\n`;
    fs.appendFileSync(indexPath, row);
  }
  return normalized;
}

function addBusinessRule({
  cwd,
  domain,
  title,
  statement,
  status = "unresolved",
  evidence = null,
  modules = null,
  confidence = null,
  verified = false
}) {
  if (status !== "unresolved" && status !== "active") throw new Error("--status must be unresolved or active.");
  if (status === "active" && !verified) throw new Error("--status active requires --verified.");
  if (status !== "active" && verified) throw new Error("--verified can only be used with --status active.");
  const projectRoot = requireProjectRoot(cwd);
  const normalizedDomain = ensureDomain(projectRoot, domain);
  const target = ruleFile(projectRoot, normalizedDomain, status);
  const content = [ruleFile(projectRoot, normalizedDomain, "active"), ruleFile(projectRoot, normalizedDomain, "unresolved")]
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
  if (content.includes(statement)) throw new Error("A matching business-rule statement already exists in this domain.");
  const id = nextRuleId(projectRoot, normalizedDomain);
  const metadata = [
    `Status: ${status}`,
    modules ? `Affected Modules: ${modules}` : null,
    evidence ? `Evidence: ${evidence}` : null,
    confidence ? `Confidence: ${confidence}` : null
  ]
    .filter(Boolean)
    .join("\n");
  fs.appendFileSync(target, `\n## ${id} — ${title}\n\n${statement}\n\n${metadata}\n\n`);
  return { id, domain: normalizedDomain, status };
}

function promoteBusinessRule({ cwd, id }) {
  const projectRoot = requireProjectRoot(cwd);
  const businessRoot = path.join(projectRoot, "spectra", "sdd", "memory-bank", "business");
  for (const domain of fs.readdirSync(businessRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const unresolved = ruleFile(projectRoot, domain, "unresolved");
    if (!fs.existsSync(unresolved)) continue;
    const content = fs.readFileSync(unresolved, "utf8");
    const match = content.match(new RegExp(`\\n## ${id}[^]*?(?=\\n## |$)`));
    if (!match) continue;
    fs.writeFileSync(unresolved, content.replace(match[0], "\n"));
    fs.appendFileSync(ruleFile(projectRoot, domain, "active"), `${match[0].replace("Status: unresolved", "Status: active")}\n`);
    return { id, domain };
  }
  throw new Error(`Unresolved business rule not found: ${id}`);
}

function transitionBusinessRule({ cwd, id, status }) {
  if (!["superseded", "deprecated"].includes(status)) throw new Error(`Unsupported business-rule transition: ${status}`);
  const projectRoot = requireProjectRoot(cwd);
  const businessRoot = path.join(projectRoot, "spectra", "sdd", "memory-bank", "business");
  for (const domain of fs.readdirSync(businessRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    for (const filePath of [ruleFile(projectRoot, domain, "active"), ruleFile(projectRoot, domain, "unresolved")]) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      const match = content.match(new RegExp(`\\n## ${id}[^]*?(?=\\n## |$)`));
      if (!match) continue;
      if (path.basename(filePath) === "unresolved.md") {
        throw new Error(`Business rule ${id} is unresolved. Promote it before changing it to ${status}.`);
      }
      fs.writeFileSync(filePath, content.replace(match[0], match[0].replace(/^Status:\s+\S+$/m, `Status: ${status}`)));
      return { id, domain, status };
    }
  }
  throw new Error(`Business rule not found: ${id}`);
}

export { addBusinessRule, promoteBusinessRule, transitionBusinessRule };
