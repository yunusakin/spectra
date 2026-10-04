// Budget-aware selection over the resolved candidates of `--route-task`.
//
// Baseline entries (role/goal policy, routing infrastructure, whole-file
// fallbacks) and required resolved objects (priority 0) are never dropped: if they
// alone exceed a budget the status is "mandatory-overflow". Optional resolved
// objects are walked in priority order and kept only while they fit the existing
// markdown budget; objects are atomic and are never truncated.
const poolOf = (entry) => (entry.mode === "summary" ? "summary" : "full");
const idOf = (entry) => entry.knowledgeId ?? entry.id ?? entry.path;

function selectContext({ baseline, resolved, budgets, superseded, fallbackError }) {
  const used = { summary: 0, full: 0 };
  for (const entry of baseline) used[poolOf(entry)] += entry.estimatedTokens;

  const included = [];
  const excluded = [];
  for (const entry of resolved.filter((candidate) => candidate.required)) {
    included.push(entry);
    used.full += entry.estimatedTokens;
  }
  const mandatory = { ...used };
  const overflow = mandatory.summary > budgets.summaryTokens || mandatory.full > budgets.markdownTokens;

  // `resolved` is already ordered by (priority, id), so the walk is deterministic.
  for (const entry of resolved.filter((candidate) => !candidate.required)) {
    if (used.full + entry.estimatedTokens <= budgets.markdownTokens) {
      included.push(entry);
      used.full += entry.estimatedTokens;
    } else {
      excluded.push({
        id: entry.knowledgeId,
        kind: entry.kind,
        status: entry.status,
        required: false,
        priority: entry.priority,
        reasons: entry.reasons,
        estimatedTokens: entry.estimatedTokens,
        exclusion: "budget"
      });
    }
  }

  const warnings = [];
  if (overflow) warnings.push({ code: "mandatory-overflow", message: `Mandatory context exceeds the budget (summary ${mandatory.summary}/${budgets.summaryTokens}, full ${mandatory.full}/${budgets.markdownTokens}); nothing was dropped or truncated.` });
  if (excluded.length > 0) warnings.push({ code: "optional-excluded", message: `${excluded.length} optional candidate(s) excluded by budget: ${excluded.map((entry) => entry.id).join(", ")}.` });
  if (fallbackError) warnings.push({ code: "exact-resolution-unavailable", message: `Knowledge Map unavailable, using whole-file routing: ${fallbackError}` });

  const pool = (name, budget) => ({ budget, used: used[name], remaining: budget - used[name] });
  const final = [...baseline, ...included];
  return {
    entries: included,
    selection: {
      status: overflow ? "mandatory-overflow" : excluded.length > 0 ? "budget-exhausted" : "within-budget",
      summary: pool("summary", budgets.summaryTokens),
      full: pool("full", budgets.markdownTokens),
      mandatory: { summary: mandatory.summary, full: mandatory.full },
      candidates: { count: resolved.length, estimatedTokens: resolved.reduce((sum, entry) => sum + entry.estimatedTokens, 0) },
      included: final.map((entry) => ({ id: idOf(entry), required: baseline.includes(entry) || entry.required === true, estimatedTokens: entry.estimatedTokens })),
      excluded,
      superseded,
      warnings
    }
  };
}

export { selectContext };
