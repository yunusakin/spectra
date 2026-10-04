// Single parser for `## RULE-… — title` sections in business-rule Markdown.
// Sections run from a `## ` heading to the next `\n## ` (so `###` sub-headings
// stay inside their rule). Identity is the full ID token in the heading, never
// a text prefix, so RULE-X-001 cannot match RULE-X-0010.
const RULE_HEADING = /^(RULE-[A-Z0-9-]+)\s+—\s+(.+)$/;

function parseRuleSections(content) {
  const starts = [...content.matchAll(/^##[ \t]+/gm)].map((match) => match.index);
  return starts.map((start, index) => {
    const next = starts[index + 1];
    const end = next === undefined ? content.length : next - 1;
    const raw = content.slice(start, end);
    const newline = raw.indexOf("\n");
    const heading = (newline === -1 ? raw : raw.slice(0, newline)).replace(/^##[ \t]+/, "");
    const match = heading.match(RULE_HEADING);
    return {
      heading,
      id: match?.[1] ?? null,
      title: match?.[2] ?? null,
      body: newline === -1 ? "" : raw.slice(newline + 1),
      raw,
      start,
      end
    };
  });
}

function findRuleSection(content, id) {
  return parseRuleSections(content).find((section) => section.id === id) ?? null;
}

function ruleStatuses(section) {
  return [...section.body.matchAll(/^Status:\s+(\S+)\s*$/gm)].map((match) => match[1]);
}

function ruleAffectedModules(section) {
  const line = section.body.match(/^Affected Modules:\s+(.+?)\s*$/m);
  return line ? line[1].split(",").map((name) => name.trim()).filter(Boolean) : [];
}

// The canonical metadata lines of a rule (see docs/business-context.md).
const RULE_METADATA_LINE = /^(Status|Affected Modules|Evidence|Confidence):/;

// What the rule says: its title and statement lines, without the ID or the
// canonical metadata lines. Any other `Word: text` line is still statement.
function ruleMeaning(section) {
  return [section.title ?? "", ...section.body.split(/\r?\n/).filter((line) => !RULE_METADATA_LINE.test(line.trim()))].join("\n");
}

export { findRuleSection, parseRuleSections, ruleAffectedModules, ruleMeaning, ruleStatuses };
