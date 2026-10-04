import path from "node:path";
import { readTextIfExists } from "./markdown.js";

const RELEASE_FILE = "RELEASE_SUMMARY.md";
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
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

const version = (heading) => SEMVER.exec(heading)?.slice(1).map(Number) ?? null;

function compareVersionsDesc(a, b) {
  for (let index = 0; index < 3; index += 1) {
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
  const unreleased = sections.find((section) => /^unreleased$/i.test(section.heading) && section.body);
  const released = sections.filter((section) => section.version).sort(compareVersionsDesc);
  if (sections.length === 0) {
    return { source: RELEASE_FILE, present: false };
  }
  const current = unreleased ?? released[0] ?? sections.find((section) => section.body) ?? null;
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
