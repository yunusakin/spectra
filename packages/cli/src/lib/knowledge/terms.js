// Deterministic lexical terms for task/knowledge matching: lowercase words of
// 4+ letters, naive plural folding, then bounded -ing/-ed folding. This is deliberately tiny, English-oriented
// lexical folding, not stemming or lemmatization; derivations (-ion, -al, ...) and a trailing -e are not folded.
const STOP = new Set([
  "that", "this", "with", "from", "have", "must", "should", "until", "when", "then", "into", "each", "been", "were",
  "which", "their", "there", "about", "after", "before", "will", "than", "also", "only", "does", "cannot",
  "rule", "status", "active", "unresolved", "affected", "module", "evidence", "confidence"
]);

// counting/counted -> count. The stem must stay >= 4 letters (so being, thing, string, needed, running, added are
// left as they are, never malformed). A doubled final consonant is restored only when the stem stays useful
// (stopped -> stop); doubled l/s/z/f and vowels are natural (installed -> install, passed -> pass).
function foldSuffix(term) {
  const stem = term.replace(/(?:ing|ed)$/, "");
  if (stem === term || stem.length < 4) return term;
  const last = stem.at(-1);
  if (last !== stem.at(-2) || /[aeiouylszf]/.test(last)) return stem;
  return stem.length >= 5 ? stem.slice(0, -1) : term;
}

function termsOf(text) {
  const terms = new Set();
  for (const word of String(text ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
    const base = word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
    if (base.length < 4 || /^\d+$/.test(base) || STOP.has(base)) continue;
    const term = foldSuffix(base);
    if (!STOP.has(term)) terms.add(term);
  }
  return [...terms].sort();
}

export { termsOf };
