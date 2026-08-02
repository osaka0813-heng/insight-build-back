# Build012.4 backend installation

Copy these files into the backend repository:

- `api/admin-verify.mjs`
- `api/health.mjs`
- `api/preflight.mjs`
- `api/publish.mjs`
- `lib/contentSafety.mjs`
- `lib/worldProcessFoundation.mjs`
- `lib/insightProcessLinkage.mjs`

Keep the existing:

- `lib/githubContent.mjs`
- `lib/publisher.mjs`

Vercel environment variables:

- `PUBLISH_API_TOKEN`
- `ADMIN_CONSOLE_TOKEN`
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH=main`
- `REMOTE_CONTENT_PATH=remote-content.json`
- optional: `GITHUB_BACKUP_DIR=backups/remote-content`

Important:

The preflight endpoint creates a small probe file in the backup directory to confirm write permission. This is expected.
