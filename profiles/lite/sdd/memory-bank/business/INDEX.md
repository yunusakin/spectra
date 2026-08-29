# Business Domain Index

> Business domains may span multiple technical modules. Add one row per domain.

| Domain | Rules | Unresolved | Related Modules |
| --- | --- | --- | --- |
*** Add File: profiles/lite/sdd/memory-bank/business/README.md
# Business Context Memory

Store durable business rules here, not technical trivia. A rule must be reusable, evidence-backed, and canonical for one domain. Put uncertain or conflicting observations in that domain's `unresolved.md`; do not promote implementation behavior to business truth without sufficient evidence.

Use `spectra route` before loading rule files. It loads only the relevant domain context.
