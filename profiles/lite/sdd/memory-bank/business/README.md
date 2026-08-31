# Business Context Memory

Store durable business rules here, not technical trivia. A rule must be reusable, evidence-backed, and canonical for one domain. Put uncertain or conflicting observations in that domain's `unresolved.md`; do not promote implementation behavior to business truth without sufficient evidence.

Use `spectra route` before loading rule files. It loads only the relevant domain context and explains matches in JSON output.

Add explicit keywords to `INDEX.md` when task language differs from the domain name. Keep uncertain claims unresolved; code behavior alone is not business truth. Use `--status active --verified` only for authoritative evidence.
