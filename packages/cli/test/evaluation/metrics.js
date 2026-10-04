// Deterministic retrieval metrics over hand-authored labels.
//
// selected   = resolved objects that reached the final pack
// candidates = selected + resolved objects excluded for budget/anchor (routing
//              index files are routing aids, not knowledge, and are ignored)
// Acceptable objects are neutral: neither rewarded nor penalised.
const round = (value) => (value === null ? null : Math.round(value * 10000) / 10000);
const ratio = (num, den) => (den === 0 ? null : round(num / den));

function score(expect, { selected, candidates, excluded }) {
  const required = new Set(expect.required ?? []);
  const relevant = new Set(expect.relevant ?? []);
  const acceptable = new Set(expect.acceptable ?? []);
  const irrelevant = new Set(expect.irrelevant ?? []);
  const wanted = (id) => required.has(id) || relevant.has(id);
  const label = (id) => (required.has(id) ? "required" : relevant.has(id) ? "relevant" : acceptable.has(id) ? "acceptable" : irrelevant.has(id) ? "irrelevant" : "unlabeled");

  const quality = (ids) => {
    const evaluated = ids.filter((id) => !acceptable.has(id));
    return { evaluated, good: evaluated.filter(wanted), bad: evaluated.filter((id) => !wanted(id)) };
  };
  const sel = quality(selected);
  const cand = quality(candidates);
  const exclusion = new Map(excluded.map((entry) => [entry.id, entry.exclusion]));
  const falseNegatives = [...required, ...relevant]
    .filter((id) => !selected.includes(id))
    .map((id) => ({ id, label: label(id), cause: candidates.includes(id) ? `${exclusion.get(id) === "anchor-excluded" ? "anchor" : "budget"}-exclusion` : "retrieval-miss" }));
  return {
    metrics: {
      requiredRecall: ratio([...required].filter((id) => selected.includes(id)).length, required.size),
      relevantRecall: ratio([...relevant].filter((id) => selected.includes(id)).length, relevant.size),
      precision: ratio(sel.good.length, sel.evaluated.length),
      candidateRecall: ratio([...required, ...relevant].filter((id) => candidates.includes(id)).length, required.size + relevant.size),
      candidatePrecision: ratio(cand.good.length, cand.evaluated.length)
    },
    falsePositives: sel.bad.map((id) => ({ id, label: label(id) })),
    falseNegatives,
    labelOf: label
  };
}

export { ratio, round, score };
