// Deterministic lexical terms for task/knowledge matching: lowercase words of
// 4+ letters, naive plural folding, no stemming beyond that.
const STOP = new Set([
  "that", "this", "with", "from", "have", "must", "should", "until", "when", "then", "into", "each", "been", "were",
  "which", "their", "there", "about", "after", "before", "will", "than", "also", "only", "does", "cannot",
  "rule", "status", "active", "unresolved", "affected", "module", "evidence", "confidence"
]);

function termsOf(text) {
  const terms = new Set();
  for (const word of String(text ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
    const term = word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
    if (term.length >= 4 && !/^\d+$/.test(term) && !STOP.has(term)) terms.add(term);
  }
  return [...terms].sort();
}

export { termsOf };
