Copy these updated/new files into the backend repository:

- api/publish.mjs
- api/preflight.mjs
- api/rollback-latest.mjs
- lib/contentSafety.mjs

Also keep all existing 012.4 files.

After deployment:
1. Open the editorial console.
2. Use “恢复最近发布前备份” once to remove the malformed latest Insight.
3. Run preflight again.
4. Republish only after the Writer Draft contains complete English content.
