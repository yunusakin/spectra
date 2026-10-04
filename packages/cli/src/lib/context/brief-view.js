import path from "node:path";
import { readTextIfExists } from "./markdown.js";

const BRIEF_FILE = "sdd/memory-bank/core/projectbrief.md";

// Removes `<!-- ... -->` authoring comments (template examples, guidance) and nothing else.
// Fenced code is literal content, so comment-looking text inside a fence stays; a comment that is
// never closed is left verbatim instead of swallowing the rest of the file. A comment on its own
// line also takes the blank lines that follow it, so no runs of empty lines are left behind.
function stripAuthoringComments(text) {
  let out = "";
  let fenced = false;
  let lineStart = true;
  let index = 0;
  while (index < text.length) {
    if (lineStart) {
      const end = text.indexOf("\n", index);
      if (/^\s*(```|~~~)/.test(text.slice(index, end < 0 ? text.length : end))) fenced = !fenced;
      lineStart = false;
    }
    if (!fenced && text.startsWith("<!--", index)) {
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

// Decide context: the canonical project brief with authoring scaffolding removed, content verbatim.
// Derived and disposable; the canonical file is never modified.
function buildDecideBrief(repoRoot) {
  return stripAuthoringComments(readTextIfExists(path.join(repoRoot, BRIEF_FILE)) ?? "").trimEnd().concat("\n");
}

export { buildDecideBrief, stripAuthoringComments };
