# Phase 1C — Findings (hand-written, from REPORT.md at the commit that added it)

Retrieval logic was **not changed** while measuring. Re-run: `node test/evaluation/run.mjs` (prints the report and timings), `UPDATE_EVALUATION=1 node --test test/evaluation.test.js` refreshes `baseline.json` / `REPORT.md`.

## Headline (normal budget, 20 cases, 25 runs with budget levels)

- required recall **100%** in every run, including tight, very-tight and mandatory-overflow
- relevant recall **90.5%**, precision **81.1%** (10 false positives, all labelled irrelevant), 4 false negatives: 2 retrieval misses, 2 budget/anchor exclusions in the deliberate overflow case
- exact objects vs whole sources: business rules **50.5%** fewer tokens, feature objects **81.2%**, Repo Index records **92.1%** (tiny worlds); in the `large-sources` world `rules.md` 1965 → 56 tokens and `feature.spec.yaml` 1031 → 53
- the pack as a whole is 5% *larger* than the whole-file model, because it now also retrieves feature objects and Repo Index records the old routing never surfaced
- timings (not stored): cold Knowledge Map + resolve 11–30 ms, warm resolve median 4 ms, max 50 ms

## Findings

| # | Finding | Class |
|---|---|---|
| 1 | No required knowledge was ever missed or dropped; explicit IDs were always selected, including `explicit-rule` / `explicit-ac` at tight and very-tight budgets (the latter ends in `mandatory-overflow` with the required objects intact). | – (gate met) |
| 2 | `business-rule-match` is the weakest signal: 3 of 7 selections relevant (42.9%). One shared term is enough (`point` pulls RULE-LOY-002 into "Expired points … paying for orders" and "Customers redeem … points"). Features need two shared terms, rules need one. | RETRIEVAL TUNING CANDIDATE |
| 3 | Rule/feature terms include metadata and ID text: an explicit `loyalty-program#FR-2` task also selected RULE-LOY-001 through `business-rule-match(loyalty)` (the `Affected Modules: loyalty-api` line plus the domain keyword). Labelled acceptable here, but the signal is accidental. | RETRIEVAL TUNING CANDIDATE |
| 4 | Feature lexical false positives on generic words: "AI-assisted onboarding wizard" selects FR-2/AC-2 on `assisted, implementation`; "update … layout … schema … migrate" selects AC-1/FR-1 on `project, runs, spectra`; "Customers redeem … points" also selects FR-2 on `customer, loyalty, point`. | RETRIEVAL TUNING CANDIDATE |
| 5 | Feature lexical false negative: "Require approval before the release is shipped" shares only `approval` with FR-2/AC-2 and retrieves nothing. It is also a knowledge gap: no requirement covers release approval. | RETRIEVAL TUNING CANDIDATE + KNOWLEDGE COVERAGE GAP |
| 6 | Relationship expansion is mostly helpful: `repo-index-evidence` 16/16 relevant (875 tokens); `feature-relationship` 4/7 relevant (the 3 wrong ones inherit a lexical false positive's tier 1). | ACCEPTABLE; see 7 |
| 7 | `feature-relationship` is tier 1 even when its seed was only a lexical match, so under tight budgets a lexical false positive can outrank a good rule match: at `very-tight`, `rule-lexical` keeps `AC-2` and drops the best match `RULE-LOY-001`. | BUDGET POLICY CANDIDATE |
| 8 | Budget selection behaves as designed: optional items drop in tier order, evidence follows its anchor, required recall stays 100%; relevant recall falls to 40% / 20% at tight / very-tight for `rule-lexical`, 50% / 25% for the approval-gating dogfood. | ACCEPTABLE |
| 9 | Greedy-continue keeps smaller lower-tier items when a larger higher-tier one does not fit (e.g. `RULE-LOY-002/003` kept while `FR-2` is dropped at tight). | ACCEPTABLE CURRENT LIMITATION |
| 10 | Real Spectra knowledge is thin: the `spectra-product` domain has no rules; only `spectra-core` FR-1/FR-2/NFR-1/AC-1/AC-2 exist. Lifecycle, context-resolver and repo-index tasks can only retrieve module evidence. | KNOWLEDGE COVERAGE GAP |
| 11 | `packages/core` and `packages/templates` declare no test script, so a changed file there has no test-target evidence. | KNOWLEDGE COVERAGE GAP |
| 12 | Fallback is correct and visible but its cost depends on file size: 88 vs 80 tokens in the small world; in the large world the whole `loyalty` rule files are about 1990 tokens against about 80 for the exact objects. | ACCEPTABLE CURRENT LIMITATION |
| 13 | Corpus is 20 hand-labelled cases; metrics are indicative, not statistically meaningful. Four labels were refined after the first run (see `corpus.yaml`). | ACCEPTABLE CURRENT LIMITATION |
| 14 | Embeddings, reranking or semantic search are not justified by this evidence: the misses are two lexical edge cases and absent knowledge. | DEFER BEYOND PHASE 1 |

## Retrieval failure vs knowledge gap

- retrieval failure: finding 5 (`FR-2` not retrieved for the release-approval task), findings 2–4 (false positives)
- knowledge-model/coverage gap: findings 5 (requirement), 10, 11
- budget exclusion (selection decision, not retrieval): the 2 FNs in `mandatory-overflow` and every FN at `tight` / `very-tight`

## Recommendation: C — improve canonical knowledge coverage first

Retrieval met the safety gate and its errors are small and mechanical (findings 2–5, 7 are one small tuning pass). The larger limiter for Spectra on itself is that the canonical knowledge barely exists: five of seven real tasks have nothing to retrieve beyond modules. Verification/traceability needs requirements and rules to trace, so coverage comes first; the tuning candidates can ship in the same stretch as a separate, measured commit (re-run this harness before and after).

## Phase 1D addendum — canonical coverage added (retrieval logic unchanged)

`spectra-product` now holds RULE-SPE-001…010 (active) and RULE-SPE-011 (unresolved), each tied to repository evidence, and its keywords gained `migration,update,uninstall,approval,cache,knowledge-map,budget`. Findings 10 and parts of the gap list are closed; the rules exposed new retrieval behaviour:

| # | Finding | Class |
|---|---|---|
| 15 | A module hint or one keyword selects the whole domain: unrelated rules arrive via `business-domain-match` or one shared generic term (`require`, `spectra`, `project`, `change`). | RETRIEVAL TUNING CANDIDATE |
| 16 | In the real repo the implementer role's `markdownTokens` (1200) is spent by the mandatory baseline (projectBrief 681, sharedCore 393) leaving ~25 tokens, so every optional rule/requirement is excluded by budget. | BUDGET POLICY CANDIDATE |
| 17 | Still open: no feature requirement for installation lifecycle, context resolver, or repo index/Knowledge Map; no release-approval requirement; no finer module than `packages-cli`; `packages/core` has no test script. | KNOWLEDGE COVERAGE GAP (needs product decisions) |
| 18 | `RULE → FR/AC` has no canonical field, so traceability between the new rules and FR-2/AC-2 is not expressible. | RELATIONSHIP GAP (later traceability phase) |
| 19 | `superseded-by-exact-object` still labels a domain's whole rules/unresolved file even when none of its rules resolved (pack.js `domain: ` entries). | OPEN 1B.2 ITEM |

## Phase 1E addendum — deterministic retrieval tuning (budgets, canonical knowledge and schema unchanged)

Frozen baseline: the unchanged Phase 1C harness on `main` 2ca0537 (20 cases). Root-cause tool: `node test/evaluation/analyze.mjs`. Three changes, each measured on its own before the next:

1. **Rule terms from meaning, not metadata** (`ruleMeaning`, Knowledge Map contract 2 → 3). `Evidence:` paths and `Affected Modules:` made `package` appear in 11/11 spectra-product rules and caused 9 of 17 false positives. Finding 3 (metadata leaking into terms) is closed.
2. **Domain-common terms are ignored** for that domain (in ≥ 2 rules and in more than 1/3 of them). Threshold sweep on the corpus: 1/2 → 6 false negatives, 1/3 and 2/5 identical (4), 1/4 added a regression; unguarded 1/3 broke `rule-affected-module` (a 2-rule domain), hence the "≥ 2 rules" guard.
3. **Whole-domain fallback needs stated domain intent** (`--domain`, or the domain name/keyword in the task prose). A module hint, or a domain word that only occurs inside an explicit reference (`loyalty-program#FR-2`), no longer widens into every rule. Removing the accidental metadata match (change 1) exposed the second case: the regression-tier `explicit-fr`/`explicit-ac` cases then pulled RULE-LOY-002/003 through `loyalty`.

| Metric (20 frozen cases, normal budget) | Before | After | Delta |
| --- | --- | --- | --- |
| required recall | 100% | 100% | 0 |
| relevant recall | 80.8% | 91.5% | +10.7 pt |
| precision | 71.7% | 82.8% | +11.1 pt |
| false positives | 17 | 10 | −7 |
| false negatives (all budget/anchor except 2 knowledge-gap misses) | 9 | 4 | −5 |
| candidate tokens | 9204 | 6433 | −30.1% |
| selected object tokens | 6775 | 6071 | −10.4% |
| business-rule-match precision | 36.8% (7/19) | 72.7% (8/11) | +35.9 pt |
| business-domain-match precision | 100% (3/3) | 60% (3/5) | −40 pt (see below) |
| budget-exhausted normal cases | 4 | 3 | −1 |

With the six cases added in Phase 1E (3 explicit references on the real Spectra knowledge, 3 generic phrases with `--module packages-cli`; labels written before the runs) the same code goes from 63.1% → 82.7% precision, 77.2% → 93.0% relevant recall, 31 → 13 false positives, 13 → 4 false negatives, 100% required recall in both.

`business-domain-match` precision fell because two false positives (RULE-LOY-002/003 in `feature-lexical-tp`) moved from `business-rule-match(point)` to the domain fallback: the task says "loyalty points", a stated domain name and keyword, and no single rule is distinguishable. That is the preserved fallback behaviour, not a new leak.

| # | Finding | Class |
| --- | --- | --- |
| 20 | Real Spectra implementer context, 4 dogfood tasks, noise removed: `markdownTokens` 1200, mandatory baseline 1175, headroom 25; relevant optional objects requested 246–350 tokens, included 0 in every task. Retrieval is no longer the reason useful knowledge is missing. | BUDGET POLICY CANDIDATE |
| 21 | Single generic-word coincidences remain: `Require a command` → RULE-SPE-001/005, `Update the package` → RULE-SPE-002, lifecycle → RULE-SPE-003 via `untouched`. Rare terms (df 1) look maximally discriminative, so frequency cannot separate them; a two-term rule would trade recall. | ACCEPTABLE CURRENT LIMITATION |
| 22 | Feature lexical matching is unchanged: `assisted, implementation` still selects FR-2 and `Require approval before the release is shipped` still misses FR-2/AC-2 (one shared term; also a coverage gap). | RETRIEVAL TUNING REMAINS (secondary) / KNOWLEDGE COVERAGE GAP |
| 23 | Domain fallback still returns the whole domain for a stated domain with no rule-level match (preserved on purpose; `domain-fallback` and the E2E fixture require it). | ACCEPTABLE CURRENT LIMITATION |
| 24 | `RULE → FR/AC` traceability and the remaining requirement gaps (findings 17, 18) are untouched. | TRACEABILITY GAP |
| 25 | `mandatory-overflow` appears once more in the "all runs" count (3 → 4): the `very-tight` padding is sized from the case's candidate tokens, which shrank. A harness artefact, not a selection change. | ACCEPTABLE CURRENT LIMITATION |

Recommendation: **A — retrieval quality is sufficient; budget policy is now the measured blocker.** Not started in this phase.
