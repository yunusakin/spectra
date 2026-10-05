import path from "node:path";

// The CLI's context JSON is location-neutral (project-relative `path`); tests that read entry files resolve
// them against the project root.
function withAbsolute(root, parsed) {
  for (const entry of parsed.entries) entry.absolutePath = path.join(root, entry.path);
  return parsed;
}

export { withAbsolute };
