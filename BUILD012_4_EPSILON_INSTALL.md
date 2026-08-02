# Build012.4 Epsilon — Writer Page 04 Fix

Replace the backend file:

- `api/write.mjs`

Then redeploy Vercel.

Changes:
- all structured-output strings require `minLength: 1`
- Page 04 receives explicit writing instructions
- the Writer automatically retries once when any Page 04 field is empty
- the final `WriterDraft` is checked again after `buildWriterDraft`
- if the mapping layer removes Page 04, `/api/write` returns the exact missing fields with HTTP 422
- the local variable is named `matchedProcess`, avoiding Node's global `process` shadowing problem
