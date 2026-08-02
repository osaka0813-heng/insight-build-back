
function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateInsightContent(content, prefix, errors, warnings, required) {
  const requiredTextPaths = [
    ['cover', 'title'],
    ['cover', 'summary'],
    ['question', 'title'],
    ['question', 'lead'],
    ['signals', 'title'],
    ['signals', 'sourceNote'],
    ['pattern', 'title'],
    ['pattern', 'before'],
    ['pattern', 'shift'],
    ['pattern', 'now'],
    ['pattern', 'conclusion'],
    ['insight', 'title'],
    ['insight', 'formula'],
    ['insight', 'explanation'],
    ['observe', 'title'],
    ['observe', 'ending'],
  ];

  const target = required ? errors : warnings;

  if (!content || typeof content !== 'object') {
    target.push(`${prefix} is missing.`);
    return;
  }

  for (const [section, field] of requiredTextPaths) {
    if (!nonEmpty(content?.[section]?.[field])) {
      target.push(`${prefix}.${section}.${field} is empty.`);
    }
  }

  if (!Array.isArray(content?.signals?.items) || content.signals.items.length === 0) {
    target.push(`${prefix}.signals.items is empty.`);
  }

  if (!Array.isArray(content?.observe?.items) || content.observe.items.length === 0) {
    target.push(`${prefix}.observe.items is empty.`);
  }
}

function unique(values = []) {
  return [...new Set(values.filter(
    (value) => typeof value === 'string' && value.trim(),
  ))];
}

export function validateContentBundle(content) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== 'object') {
    errors.push('Content bundle must be an object.');
    return { ok: false, errors, warnings };
  }

  if (!Number.isFinite(content.schemaVersion)) {
    errors.push('schemaVersion is required.');
  }

  for (const key of ['insights', 'worldProcesses', 'dailyStates']) {
    if (!Array.isArray(content[key])) {
      errors.push(`${key} must be an array.`);
    }
  }

  const collections = [
    ['insights', content.insights || []],
    ['worldProcesses', content.worldProcesses || []],
    ['dailyStates', content.dailyStates || []],
  ];

  for (const [name, collection] of collections) {
    const ids = collection
      .map((item) => item?.id)
      .filter((id) => typeof id === 'string' && id.trim());

    if (ids.length !== collection.length) {
      errors.push(`${name} contains records without a valid id.`);
    }

    if (unique(ids).length !== ids.length) {
      errors.push(`${name} contains duplicate ids.`);
    }
  }


  for (const insight of content.insights || []) {
    validateInsightContent(
      insight?.content?.en,
      `Insight ${insight?.id || 'unknown'}.content.en`,
      errors,
      warnings,
      true,
    );

    for (const language of ['zh', 'ja']) {
      if (insight?.content?.[language]) {
        validateInsightContent(
          insight.content[language],
          `Insight ${insight.id}.content.${language}`,
          errors,
          warnings,
          false,
        );
      }
    }
  }

  const insightIds = new Set(
    (content.insights || []).map((item) => item?.id).filter(Boolean),
  );
  const processIds = new Set(
    (content.worldProcesses || []).map((item) => item?.id).filter(Boolean),
  );

  for (const state of content.dailyStates || []) {
    if (state?.insightId && !insightIds.has(state.insightId)) {
      errors.push(
        `Daily State ${state.id} references missing Insight ${state.insightId}.`,
      );
    }
  }

  for (const insight of content.insights || []) {
    if (insight?.processId && !processIds.has(insight.processId)) {
      errors.push(
        `Insight ${insight.id} references missing World Process ${insight.processId}.`,
      );
    }
  }

  for (const process of content.worldProcesses || []) {
    for (const insightId of [
      ...(process?.insightIds || []),
      ...(process?.supportingInsightIds || []),
      ...(process?.contradictingInsightIds || []),
    ]) {
      if (!insightIds.has(insightId)) {
        warnings.push(
          `World Process ${process.id} references unavailable Insight ${insightId}.`,
        );
      }
    }
  }

  if (!(content.insights || []).length) {
    errors.push('At least one Insight is required.');
  }

  if (!(content.dailyStates || []).length) {
    warnings.push('No Daily State is available.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function githubConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error(
      'GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN are required.',
    );
  }

  return { owner, repo, branch, token };
}

async function githubRequest(url, options = {}) {
  const { token } = githubConfig();
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      payload?.message || `GitHub request failed (${response.status}).`,
    );
  }

  return payload;
}

export async function createContentBackup(content, reviewedAt) {
  const { owner, repo, branch } = githubConfig();
  const directory =
    process.env.GITHUB_BACKUP_DIR || 'backups/remote-content';
  const safeTime = reviewedAt.replace(/[:.]/g, '-');
  const safeVersion = String(content.contentVersion || 'unknown')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 80);
  const path = `${directory}/${safeTime}-${safeVersion}.json`;
  const url =
    `https://api.github.com/repos/${owner}/${repo}/contents/` +
    path.split('/').map(encodeURIComponent).join('/');

  const payload = await githubRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Backup remote content before publish ${reviewedAt}`,
      content: Buffer.from(
        JSON.stringify(content, null, 2) + '\n',
        'utf8',
      ).toString('base64'),
      branch,
    }),
  });

  return {
    path,
    commitSha: payload?.commit?.sha,
    contentSha: payload?.content?.sha,
  };
}

export function findProcessedDraft(content, writerDraft, action) {
  const record = (content?.writerDrafts || []).find(
    (item) => item?.id === writerDraft?.id,
  );

  if (!record?.review?.decision) return undefined;

  const expected =
    action === 'approve' ? 'approved' : 'rejected';

  return {
    alreadyProcessed: true,
    sameDecision: record.review.decision === expected,
    decision: record.review.decision,
    reviewedAt: record.review.reviewedAt,
  };
}

export function requiredEnvironmentChecks() {
  const required = [
    'PUBLISH_API_TOKEN',
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPO',
  ];

  return required.map((name) => ({
    name,
    ok: Boolean(process.env[name]),
  }));
}

export async function readLatestContentBackup() {
  const { owner, repo, branch } = githubConfig();
  const directory =
    process.env.GITHUB_BACKUP_DIR || 'backups/remote-content';
  const listUrl =
    `https://api.github.com/repos/${owner}/${repo}/contents/` +
    directory.split('/').map(encodeURIComponent).join('/') +
    `?ref=${encodeURIComponent(branch)}`;

  const items = await githubRequest(listUrl);
  const candidates = (Array.isArray(items) ? items : [])
    .filter(
      (item) =>
        item?.type === 'file' &&
        typeof item?.name === 'string' &&
        item.name.endsWith('.json') &&
        !item.name.includes('preflight-probe'),
    )
    .sort((a, b) => b.name.localeCompare(a.name));

  const latest = candidates[0];
  if (!latest?.url) {
    throw new Error('No publish backup is available.');
  }

  const file = await githubRequest(latest.url);
  const decoded = Buffer.from(
    String(file.content || '').replace(/\n/g, ''),
    'base64',
  ).toString('utf8');

  const content = JSON.parse(decoded);
  return {
    path: latest.path,
    content,
  };
}
