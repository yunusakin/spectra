import path from "node:path";
import { readTextIfExists } from "./markdown.js";

const RELEASE_FILE = "RELEASE_SUMMARY.md";
// `v1.2.3`, `1.2.3-rc.1`, `[1.2.3] - 2026-01-01`, `v1.2.3 (date)`: a version, then the end or a separator.
const SEMVER = /^\[?v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\]?(?:\s|$|\()/;
const UNRELEASED = /^\[?unreleased\]?(?:\s|$|\()/i;
const PLACEHOLDER = /^(none|n\/a|nothing( yet)?|no changes( yet)?|tbd|todo)\.?$/i;
const EARLIER_HEADINGS = 3;

function splitSections(text) {
  const sections = [];
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      sections.push({ heading: heading[1], lines: [] });
    } else if (sections.length > 0) {
      sections.at(-1).lines.push(line);
    }
  }
  return sections.map((section) => ({ heading: section.heading, body: section.lines.join("\n").trim() }));
}

// [major, minor, patch, 1 for a final release | 0 for a pre-release]: a final outranks its own rc.
function version(heading) {
  const match = SEMVER.exec(heading);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ? 0 : 1] : null;
}

// A body that is only comments or "None"-style placeholders is not release content.
function hasContent(body) {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s+/, "").replace(/[_*]/g, "").trim())
    .some((line) => line && !PLACEHOLDER.test(line));
}

function compareVersionsDesc(a, b) {
  for (let index = 0; index < 4; index += 1) {
    if (a.version[index] !== b.version[index]) return b.version[index] - a.version[index];
  }
  return a.order - b.order;
}

// Release-manager context: the section being shipped in full, plus headings only for history.
// Deterministic, derived from RELEASE_SUMMARY.md and never written back. The current section is
// "Unreleased" when it has content, otherwise the highest version; file order is not trusted.
function parseReleaseSummary(repoRoot) {
  const text = readTextIfExists(path.join(repoRoot, RELEASE_FILE));
  const sections = splitSections(text ?? "").map((section, order) => ({ ...section, order, version: version(section.heading) }));
  const unreleased = sections.find((section) => UNRELEASED.test(section.heading) && hasContent(section.body));
  const released = sections.filter((section) => section.version).sort(compareVersionsDesc);
  if (sections.length === 0) {
    return { source: RELEASE_FILE, present: false };
  }
  const current = unreleased ?? released[0] ?? sections.find((section) => hasContent(section.body)) ?? null;
  const earlier = released.filter((section) => section !== current);

  return {
    source: RELEASE_FILE,
    present: true,
    current: current ? { heading: current.heading, text: current.body } : null,
    latestReleased: released[0]?.heading ?? null,
    earlierReleases: { count: earlier.length, recent: earlier.slice(0, EARLIER_HEADINGS).map((section) => section.heading) }
  };
}

export { parseReleaseSummary };
