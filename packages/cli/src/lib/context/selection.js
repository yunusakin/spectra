// Budget-aware selection over the resolved candidates of `--route-task`.
//
// Baseline entries (role/goal policy, routing policy, whole-file fallbacks) and
// required resolved objects (priority 0) are never dropped: if they alone exceed a
// budget the status is "mandatory-overflow". Optional entries are walked in
// priority order and kept only while they fit the existing markdown budget:
// resolved objects first (already ordered by priority, then id), then the routing
// index files (`optionalBaseline`, lowest tier), which only explain routing once
// exact objects are resolved. Evidence-only candidates (Repo Index records reached
// solely through another candidate) are kept only if that anchor was kept. Entries
// are atomic and are never truncated.
// Summary entries count toward the summary budget; full files and resolved objects toward markdown.
const poolOf = (entry) => (entry.mode === "summary" ? "summary" : "full");
const ROUTING_INDEX_PRIORITY = 7;
const idOf = (entry) => entry.knowledgeId ?? entry.id ?? entry.path;
const evidenceOnly = (entry) => (entry.reasons ?? []).every(({ reason }) => reason === "repo-index-evidence");

// Evidence never outranks the anchor it hangs off: a module reached only from a
// domain-fallback rule (tier 5) sorts at tier 5, after that rule, so a single
// ordered pass always sees the anchor first.
function sortWithAnchors(resolved) {
  const byId = new Map(resolved.map((entry) => [entry.knowledgeId, entry]));
  const memo = new Map();
  const effective = (entry) => {
    if (!memo.has(entry.knowledgeId)) {
      memo.set(entry.knowledgeId, entry.priority); // cycle guard: evidence chains are acyclic
      if (!entry.required && evidenceOnly(entry)) {
        const anchors = entry.reasons.map(({ via }) => byId.get(via)).filter(Boolean).map(effective);
        if (anchors.length > 0) memo.set(entry.knowledgeId, Math.max(entry.priority, Math.min(...anchors)));
      }
    }
    return memo.get(entry.knowledgeId);
  };
  const rank = (entry) => [effective(entry), evidenceOnly(entry) ? 1 : 0];
  return [...resolved].sort((a, b) => {
    const [ea, ta] = rank(a);
    const [eb, tb] = rank(b);
    return ea - eb || ta - tb || (a.knowledgeId < b.knowledgeId ? -1 : a.knowledgeId > b.knowledgeId ? 1 : 0);
  });
}

function selectContext({ baseline, resolved, optionalBaseline = [], budgets, superseded, fallbackError }) {
  const used = { summary: 0, full: 0 };
  for (const entry of baseline) used[poolOf(entry)] += entry.estimatedTokens;

  const ordered = sortWithAnchors(resolved);
  const included = [];
  const excluded = [];
  for (const entry of ordered.filter((candidate) => candidate.required)) {
    included.push(entry);
    used.full += entry.estimatedTokens;
  }
  const mandatory = { ...used };
  const overflow = mandatory.summary > budgets.summaryTokens || mandatory.full > budgets.markdownTokens;

  // Anchors (rules, modules) sort before the evidence that hangs off them, so a
  // single pass sees whether an anchor was kept.
  const keptIds = new Set(included.map(idOf));
  for (const entry of [...ordered.filter((candidate) => !candidate.required), ...optionalBaseline]) {
    const anchored = !(entry.reasons && evidenceOnly(entry)) || entry.reasons.some(({ via }) => keptIds.has(via));
    if (anchored && used.full + entry.estimatedTokens <= budgets.markdownTokens) {
      included.push(entry);
      keptIds.add(idOf(entry));
      used.full += entry.estimatedTokens;
    } else {
      excluded.push({
        id: idOf(entry),
        kind: entry.kind ?? "routing-index",
        status: entry.status,
        required: false,
        priority: entry.priority ?? ROUTING_INDEX_PRIORITY,
        reasons: entry.reasons ?? [{ reason: entry.reason, via: "route" }],
        estimatedTokens: entry.estimatedTokens,
        exclusion: anchored ? "budget" : "anchor-excluded"
      });
    }
  }

  const warnings = [];
  if (overflow) warnings.push({ code: "mandatory-overflow", message: `Mandatory context exceeds the budget (summary ${mandatory.summary}/${budgets.summaryTokens}, full ${mandatory.full}/${budgets.markdownTokens}); nothing was dropped or truncated.` });
  if (excluded.length > 0) warnings.push({ code: "optional-excluded", message: `${excluded.length} optional candidate(s) excluded (budget or excluded anchor): ${excluded.map((entry) => entry.id).join(", ")}.` });
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

export { poolOf, selectContext };
