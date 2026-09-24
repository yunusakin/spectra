import assert from "node:assert/strict";
import test from "node:test";
import {
  countByStatus,
  extractBulletMap,
  extractChecklist,
  extractList,
  firstMeaningfulLine,
  isPlaceholderRow,
  isPlaceholderValue,
  isTemplateLine,
  meaningfulLines,
  parseMarkdownTable,
  parseSections,
  splitTableRow,
  stripComments
} from "../src/lib/context/markdown.js";

// ---------------------------------------------------------------------------
// parseSections: heading variations, whitespace, empty sections, CRLF
// ---------------------------------------------------------------------------

test("parseSections splits on level-2 headings and keeps pre-heading content", () => {
  const sections = parseSections("# Title\nintro line\n## Purpose\nDo things\n##  Spaced  \n\n");
  assert.equal(sections.__root__, "# Title\nintro line");
  assert.equal(sections.Purpose, "Do things");
  assert.equal(sections.Spaced, "");
});

test("parseSections only treats '## ' as a section boundary", () => {
  const sections = parseSections("## A\nbody\n### deep heading\n### deeper\n##B no space\nlast");
  assert.equal(sections.A, "body\n### deep heading\n### deeper\n##B no space\nlast");
  assert.equal(Object.keys(sections).length, 2);
});

test("parseSections tolerates CRLF line endings", () => {
  const sections = parseSections("## A\r\nline one\r\nline two\r\n");
  assert.equal(sections.A, "line one\nline two");
});

test("parseSections resets a repeated heading instead of merging", () => {
  // Characterization: a second heading with the same name starts a fresh
  // section; earlier content for that name is discarded.
  const sections = parseSections("## A\nfirst\n## A\nsecond");
  assert.equal(sections.A, "second");
});

test("parseSections on empty input keeps an empty root section", () => {
  assert.deepEqual(parseSections(""), { __root__: "" });
});

// ---------------------------------------------------------------------------
// comments, whitespace, placeholder detection
// ---------------------------------------------------------------------------

test("stripComments removes single- and multi-line comments", () => {
  assert.equal(stripComments("a <!-- note --> b"), "a  b");
  assert.equal(stripComments("a <!-- one\ntwo --> b"), "a  b");
  assert.equal(stripComments("no comments"), "no comments");
});

test("isPlaceholderValue recognizes template placeholders", () => {
  for (const value of ["", "   ", "-", "(none)", "(n/a)", "<anything>", "`<pending review>`", "<Pending>", "<0-100%>", "`a|b`", "YYYY-MM-DD", "YYYY-MM-DD or later"]) {
    assert.equal(isPlaceholderValue(value), true, JSON.stringify(value));
  }
});

test("isPlaceholderValue does not reject real content", () => {
  for (const value of ["TBD", "2026-01-01", "shipped in 3.0.9", "n/a fallback", "- none"]) {
    assert.equal(isPlaceholderValue(value), false, JSON.stringify(value));
  }
});

test("isTemplateLine flags headings, quotes, and intake filler", () => {
  assert.equal(isTemplateLine("## Heading"), true);
  assert.equal(isTemplateLine("# Deep"), true);
  assert.equal(isTemplateLine("> quoted guidance"), true);
  assert.equal(isTemplateLine("Filled by intake later"), true);
  assert.equal(isTemplateLine("Filled before execution"), true);
  assert.equal(isTemplateLine("- (none)"), true);
  assert.equal(isTemplateLine("- (N/A)"), true);
  assert.equal(isTemplateLine("real content"), false);
});

// ---------------------------------------------------------------------------
// meaningful lines / first line
// ---------------------------------------------------------------------------

test("meaningfulLines drops comments, headings, and template lines", () => {
  const lines = meaningfulLines("<!-- c -->\n## H\n- item\n> quote\n\nreal one\nreal two");
  assert.deepEqual(lines, ["- item", "real one", "real two"]);
});

test("firstMeaningfulLine strips bullet markers and skips template content", () => {
  assert.equal(firstMeaningfulLine("## Title\n<!-- x -->\n- Real line\n"), "Real line");
  assert.equal(firstMeaningfulLine("## Title\n- (none)"), null);
  assert.equal(firstMeaningfulLine("plain text"), "plain text");
  assert.equal(firstMeaningfulLine("  \n\nactual"), "actual");
  assert.equal(firstMeaningfulLine(""), null);
});

// ---------------------------------------------------------------------------
// lists, checklists, bullet maps
// ---------------------------------------------------------------------------

test("extractList takes real bullets up to the limit", () => {
  const text = "<!-- - hidden -->\n- one\n* two\n-  three\n- <pending>\nplain text\n";
  assert.deepEqual(extractList(text), ["one", "two", "three"]);
  assert.deepEqual(extractList(text, 2), ["one", "two"]);
  assert.deepEqual(extractList("no bullets"), []);
});

test("extractChecklist handles checkbox variations", () => {
  const text = [
    "- [ ] todo",
    "- [x] done",
    "- [X] upper",
    "* [x] star is not dash-checkbox syntax",
    "- [?] invalid mark",
    "- [ ]"
  ].join("\n");
  assert.deepEqual(extractChecklist(text), [
    { label: "todo", done: false },
    { label: "done", done: true },
    { label: "upper", done: true }
  ]);
});

test("extractChecklist is not confused by commented or indented noise", () => {
  const text = "<!--\n- [x] hidden\n-->\nSome text\n- [ ] real\n";
  assert.deepEqual(extractChecklist(text), [{ label: "real", done: false }]);
});

test("extractBulletMap keeps key/value bullets and skips placeholders", () => {
  const text = [
    "- Status: done",
    "- Owner: <none>",
    "-Empty: no-space-after-dash",
    "- NoSpace:colon-without-space",
    "- Count: 12",
    "- Detail: has: colon in value"
  ].join("\n");
  assert.deepEqual(extractBulletMap(text), {
    Status: "done",
    Count: "12",
    Detail: "has: colon in value"
  });
});

// ---------------------------------------------------------------------------
// table parsing
// ---------------------------------------------------------------------------

test("splitTableRow normalizes cells with or without outer pipes", () => {
  assert.deepEqual(splitTableRow("| a | b |"), ["a", "b"]);
  assert.deepEqual(splitTableRow("|a|b|"), ["a", "b"]);
  assert.deepEqual(splitTableRow("a | b"), ["a", "b"]);
  assert.deepEqual(splitTableRow("|   spaced    cell   |"), ["spaced cell"]);
});

test("splitTableRow keeps escaped pipes inside a cell", () => {
  assert.deepEqual(splitTableRow("| use \\| here | open |"), ["use | here", "open"]);
});

test("isPlaceholderRow requires every cell to be a placeholder", () => {
  assert.equal(isPlaceholderRow(["<id>", "<name>"]), true);
  assert.equal(isPlaceholderRow(["none", "n/a"]), true);
  assert.equal(isPlaceholderRow(["", "-"]), true);
  assert.equal(isPlaceholderRow(["open", "resolved"]), false);
  assert.equal(isPlaceholderRow(["TBD", "-"]), false);
});

test("parseMarkdownTable reads rows and maps empty or missing cells", () => {
  const table = [
    "| Question | Status |",
    "| -------- | ------ |",
    "| What is the flow? | open |",
    "| | blocked |",
    "| Done | resolved | extra cells dropped |",
    "| <q> | <s> |",
    "| TBD | - |"
  ].join("\n");
  const rows = parseMarkdownTable(table);
  assert.deepEqual(rows, [
    { question: "What is the flow?", status: "open" },
    { question: "", status: "blocked" },
    { question: "Done", status: "resolved" },
    { question: "TBD", status: "-" }
  ]);
});

test("parseMarkdownTable skips the separator row and supports aligned separators", () => {
  const table = [
    "| A | B |",
    "| :--- | ---: |",
    "| 1 | 2 |"
  ].join("\n");
  assert.deepEqual(parseMarkdownTable(table), [{ a: "1", b: "2" }]);
});

test("parseMarkdownTable returns no rows for header-only or malformed tables", () => {
  assert.deepEqual(parseMarkdownTable("| Question | Status |"), []);
  assert.deepEqual(parseMarkdownTable(""), []);
  assert.deepEqual(parseMarkdownTable("plain text, not a table\nmore text"), []);
});

test("parseMarkdownTable ignores commented-out rows and non-table lines", () => {
  const table = [
    "## Open Technical Questions",
    "<!-- | hidden | row | -->",
    "| Question | Status |",
    "| --- | --- |",
    "text between rows",
    "| Real | open |",
    "<!--\n| also | hidden |\n-->"
  ].join("\n");
  assert.deepEqual(parseMarkdownTable(table), [{ question: "Real", status: "open" }]);
});

test("parseMarkdownTable preserves escaped pipes inside cells", () => {
  const table = [
    "| Question | Status |",
    "| --- | --- |",
    "| Use \\| in answers | open |"
  ].join("\n");
  assert.deepEqual(parseMarkdownTable(table), [
    { question: "Use | in answers", status: "open" }
  ]);
});

test("countByStatus counts case-insensitively with overlapping matchers", () => {
  const rows = [{ status: "open" }, { status: "OPEN" }, { status: "resolved" }, {}];
  const counts = countByStatus(rows, "status", {
    open: (value) => value === "open",
    resolved: (value) => value === "resolved",
    blocked: (value) => value === "blocked"
  });
  assert.deepEqual(counts, { open: 2, resolved: 1, blocked: 0 });
});

// ---------------------------------------------------------------------------
// file reads
// ---------------------------------------------------------------------------
