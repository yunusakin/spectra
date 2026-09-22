import fs from "node:fs";

// Markdown parsing helpers, kept separate from context policy/selection.
function parseSections(markdown) {
  const sections = {};
  const lines = markdown.replace(/\r/g, "").split("\n");
  let current = "__root__";
  sections[current] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      current = headingMatch[1].trim();
      sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, value.join("\n").trim()])
  );
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isPlaceholderValue(value) {
  const normalized = normalizeWhitespace(String(value ?? ""));
  return (
    normalized === "" ||
    normalized === "-" ||
    normalized === "(none)" ||
    normalized === "(n/a)" ||
    /^`?<[^>]+>`?$/.test(normalized) ||
    /^`?<(none|n\/a)[^>]*>`?$/i.test(normalized) ||
    /^`[^`]*\|[^`]*`$/.test(normalized) ||
    /^`?<pending.*>`?$/i.test(normalized) ||
    /^`?<done.*>`?$/i.test(normalized) ||
    /^`?<0-100%>`?$/.test(normalized) ||
    /^`?<milestone>`?$/.test(normalized) ||
    /^`?<step>`?$/.test(normalized) ||
    /^`?<important context>`?$/.test(normalized) ||
    /^`?<target-project-name>`?$/.test(normalized) ||
    /^`?<absolute-target-project-path>`?$/.test(normalized) ||
    /^`?<owner\/repo or local>`?$/.test(normalized) ||
    /^`?<owner-or-team>`?$/.test(normalized) ||
    /^`?<item-id>`?$/.test(normalized) ||
    /^`?<one-sentence objective for the target project>`?$/.test(normalized) ||
    /^YYYY-MM-DD/.test(normalized)
  );
}

function isTemplateLine(line) {
  return (
    isPlaceholderValue(line) ||
    /^>\s/.test(line) ||
    /^#{1,6}\s/.test(line) ||
    /\bFilled by intake\b/i.test(line) ||
    /\bFilled before execution\b/i.test(line) ||
    /^- \((none|n\/a)\)$/i.test(line)
  );
}

function meaningfulLines(text) {
  return stripComments(text)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => !isTemplateLine(line));
}

function firstMeaningfulLine(text) {
  const [line] = meaningfulLines(text);
  const value = line ? line.replace(/^[-*]\s+/, "") : null;
  return isPlaceholderValue(value) ? null : value;
}

function extractList(text, limit = 5) {
  const items = stripComments(text)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""))
    .filter((line) => !isPlaceholderValue(line));
  return items.slice(0, limit);
}

function extractChecklist(text) {
  return stripComments(text)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => /^- \[[ xX]\]\s+/.test(line))
    .map((line) => ({
      label: line.replace(/^- \[[ xX]\]\s+/, ""),
      done: /^- \[[xX]\]/.test(line)
    }));
}

function extractBulletMap(text) {
  const map = {};
  for (const line of stripComments(text).split(/\r?\n/)) {
    const trimmed = normalizeWhitespace(line);
    const match = trimmed.match(/^-\s+([^:]+):\s+(.+)$/);
    if (!match) {
      continue;
    }
    const value = match[2].trim();
    if (isPlaceholderValue(value)) {
      continue;
    }
    map[match[1].trim()] = value;
  }
  return map;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => normalizeWhitespace(cell));
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function isPlaceholderRow(cells) {
  return cells.every(
    (cell) => isPlaceholderValue(cell) || /^<[^>]+>$/.test(cell) || /^(none|n\/a|no)$/i.test(normalizeWhitespace(cell))
  );
}

function parseMarkdownTable(text) {
  const lines = stripComments(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 2) {
    return [];
  }

  const headers = splitTableRow(lines[0]).map(normalizeHeader);
  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitTableRow(lines[index]);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      continue;
    }
    if (isPlaceholderRow(cells)) {
      continue;
    }
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = cells[headerIndex] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function countByStatus(rows, fieldName, mapping) {
  const result = {};
  for (const key of Object.keys(mapping)) {
    result[key] = 0;
  }

  for (const row of rows) {
    const value = (row[fieldName] ?? "").toLowerCase();
    for (const [key, matcher] of Object.entries(mapping)) {
      if (matcher(value)) {
        result[key] += 1;
      }
    }
  }

  return result;
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}


export { countByStatus, extractBulletMap, extractChecklist, extractList, firstMeaningfulLine, isPlaceholderRow, isPlaceholderValue, isTemplateLine, meaningfulLines, normalizeHeader, normalizeWhitespace, parseMarkdownTable, parseSections, readTextIfExists, splitTableRow, stripComments };
