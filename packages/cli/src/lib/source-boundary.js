// Which repository paths can change what a verification observed or what a change concerns.
//
// A project holds four kinds of path: application source, canonical project intelligence (specs, business rules, the
// module map), Spectra bookkeeping (governance state, progress notes, adoption/discovery output, install metadata) and
// disposable or observation-bearing output (caches, evidence, eval reports). Only the first two are inputs. Spectra
// writing its own bookkeeping or output must never look like the project changing, or verification could never settle.
//
// Paths are repository-relative (`.spectra/sdd/...`) or data-root-relative (`sdd/...`, as `toDataRelative` returns).

const SPECTRA_PATH = /^(?:\.spectra\/|sdd\/)/;
const ROOT = "(?:\\.spectra\\/)?sdd\\/";

// What may stale a test target's evidence. Deliberately narrow: the requirement/scenario/invariant/verifiedBy
// declarations, the business rules and the module map. Checklist boxes, progress notes, approvals, reports and
// caches do not change what a test observed.
const FINGERPRINT_INPUT = new RegExp(`^${ROOT}(?:features\\/[^/]+\\/feature\\.spec\\.yaml|memory-bank\\/business\\/[^/]+\\/rules\\.md|memory-bank\\/tech\\/modules\\.md)$`);

// What a change can concern for impact and review scoping: canonical project intelligence, but never derived output.
const IMPACT_INPUT = new RegExp(`^${ROOT}(?:features\\/(?!(?:[^/]+\\/evals\\/reports\\/))|memory-bank\\/business\\/|memory-bank\\/tech\\/)`);

const isSpectraPath = (file) => SPECTRA_PATH.test(file);

// A file inside Spectra's data root counts for verification freshness only when it is a canonical declaration.
const countsForFingerprint = (file) => !isSpectraPath(file) || FINGERPRINT_INPUT.test(file);

// Application files always count; Spectra files count only when canonical.
const countsForImpact = (file) => !isSpectraPath(file) || IMPACT_INPUT.test(file);

export { countsForFingerprint, countsForImpact, isSpectraPath };
