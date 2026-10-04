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
