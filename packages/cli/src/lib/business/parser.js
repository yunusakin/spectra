function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeWords(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((value) => value.trim());
}

function readMarkdownTableContent(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
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

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map(normalize)
    .filter(Boolean);
}

function splitRawList(value) {
  return String(value ?? "").split(",").map((item) => item.trim());
}

function parseRuleStatement(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[A-Za-z][A-Za-z ]*:\s+/.test(line))[0] ?? "";
}

function taskTokens(value) {
  return new Set(normalizeWords(value));
}

function taskContainsNormalized(taskTokenSet, normalizedValue) {
  if (!normalizedValue) return false;
  const parts = normalizedValue.split("-").filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((part) => taskTokenSet.has(part));
}

function rowValue(row, name) {
  const normalizedName = normalize(name);
  const underscoreName = normalizedName.replace(/-/g, "_");
  return row[normalizedName] ?? row[underscoreName] ?? "";
}

export {
  normalize,
  parseRuleStatement,
  readMarkdownTableContent,
  rowValue,
  splitList,
  splitRawList,
  splitTableRow,
  taskContainsNormalized,
  taskTokens
};
