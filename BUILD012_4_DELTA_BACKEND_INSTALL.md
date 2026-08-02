Copy these files into the backend repository:

- api/publish.mjs
- lib/writerDraftRepair.mjs
- lib/contentSafety.mjs

Keep all other 012.4 Gamma backend files.

Only the Page 04 section title is repaired automatically. Missing factual body
fields are returned explicitly and publication is blocked.
