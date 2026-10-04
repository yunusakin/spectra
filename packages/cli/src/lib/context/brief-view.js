import path from "node:path";
import { readTextIfExists } from "./markdown.js";

const BRIEF_FILE = "sdd/memory-bank/core/projectbrief.md";

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// Removes `<!-- ... -->` authoring comments (template examples, guidance) and nothing else.
// Literal content is kept: fenced code (tracked like CommonMark: same character, at least as long
// to close) and inline code spans. A comment that is never closed is left verbatim instead of
// swallowing the rest of the file. A comment on its own line also takes the blank lines that
// follow it, so no runs of empty lines are left behind.
function stripAuthoringComments(text) {
  let out = "";
  let fence = null;
  let lineStart = true;
  let index = 0;
  while (index < text.length) {
    if (lineStart) {
      const newline = text.indexOf("\n", index);
      const end = newline < 0 ? text.length : newline + 1;
      const line = text.slice(index, end);
      const marker = FENCE.exec(line.replace(/\r?\n$/, ""));
      if (fence) {
        if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && marker[2].trim() === "") fence = null;
        out += line;
        index = end;
        continue;
      }
      if (marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
        fence = { char: marker[1][0], length: marker[1].length };
        out += line;
        index = end;
        continue;
      }
      lineStart = false;
    }
    if (text[index] === "`") {
      const span = codeSpanEnd(text, index);
      out += text.slice(index, span);
      index = span;
      continue;
    }
    if (text.startsWith("<!--", index)) {
      const close = text.indexOf("-->", index + 4);
      if (close >= 0) {
        const ownLine = out === "" || out.endsWith("\n");
        index = close + 3;
        if (ownLine) index += /^[ \t]*(\r?\n)*/.exec(text.slice(index))[0].length;
        lineStart = ownLine;
        continue;
      }
    }
    out += text[index];
    lineStart = text[index] === "\n";
    index += 1;
  }
  return out;
}

// End index of the code span opening at `start` (a backtick run closed by a run of equal length
// within the same paragraph), or just past the opening run when it is literal backticks.
function codeSpanEnd(text, start) {
  let length = 0;
  while (text[start + length] === "`") length += 1;
  let cursor = start + length;
  while ((cursor = text.indexOf("`", cursor)) >= 0) {
    let run = 0;
    while (text[cursor + run] === "`") run += 1;
    if (run === length) {
      return /\n[ \t]*\n/.test(text.slice(start, cursor)) ? start + length : cursor + run;
    }
    cursor += run;
  }
  return start + length;
}

// Decide context: the canonical project brief with authoring scaffolding removed, content verbatim.
// Derived and disposable; the canonical file is never modified.
function buildDecideBrief(repoRoot) {
  return stripAuthoringComments(readTextIfExists(path.join(repoRoot, BRIEF_FILE))).trimEnd().concat("\n");
}

export { buildDecideBrief, stripAuthoringComments };
