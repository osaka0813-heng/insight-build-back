import processCatalog from '../data/world-process-catalog.json' with { type: 'json' };
import { buildWriterDraft } from '../lib/writer.mjs';

const OPENAI_URL = 'https://api.openai.com/v1/responses';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-research-token',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, status, value) {
  setCors(res);
  return res.status(status).json(value);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;

  try {
    return JSON.parse(req.body);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
}

function extractOutputText(payload) {
  if (
    typeof payload?.output_text === 'string' &&
    payload.output_text.trim()
  ) {
    return payload.output_text;
  }

  for (const item of payload?.output || []) {
    if (item?.type !== 'message') continue;

    for (const part of item.content || []) {
      if (
        part?.type === 'output_text' &&
        typeof part.text === 'string'
      ) {
        return part.text;
      }
    }
  }

  throw new Error('OpenAI response did not contain output_text.');
}

const nonEmptyString = {
  type: 'string',
  minLength: 1,
};

const localizedPageSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'cover',
    'question',
    'signals',
    'pattern',
    'insight',
    'observe',
  ],
  properties: {
    cover: {
      type: 'object',
      additionalProperties: false,
      required: [
        'eyebrow',
        'secondaryEyebrow',
        'title',
        'summary',
      ],
      properties: {
        eyebrow: nonEmptyString,
        secondaryEyebrow: nonEmptyString,
        title: nonEmptyString,
        summary: nonEmptyString,
      },
    },
    question: {
      type: 'object',
      additionalProperties: false,
      required: ['lead', 'title', 'footnote'],
      properties: {
        lead: nonEmptyString,
        title: nonEmptyString,
        footnote: nonEmptyString,
      },
    },
    signals: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'sourceNote', 'items'],
      properties: {
        title: nonEmptyString,
        sourceNote: nonEmptyString,
        items: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'label',
              'title',
              'body',
              'whyImportant',
              'evidence',
            ],
            properties: {
              label: nonEmptyString,
              title: nonEmptyString,
              body: nonEmptyString,
              whyImportant: nonEmptyString,
              evidence: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'title',
                  'description',
                  'confidence',
                  'sourceIds',
                ],
                properties: {
                  title: nonEmptyString,
                  description: nonEmptyString,
                  confidence: {
                    type: 'string',
                    enum: [
                      'verified',
                      'developing',
                      'hypothesis',
                    ],
                  },
                  sourceIds: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 6,
                    items: nonEmptyString,
                  },
                },
              },
            },
          },
        },
      },
    },
    pattern: {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'before',
        'shift',
        'now',
        'conclusion',
      ],
      properties: {
        title: nonEmptyString,
        before: nonEmptyString,
        shift: nonEmptyString,
        now: nonEmptyString,
        conclusion: nonEmptyString,
      },
    },
    insight: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'formula', 'explanation'],
      properties: {
        title: nonEmptyString,
        formula: nonEmptyString,
        explanation: nonEmptyString,
      },
    },
    observe: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'items', 'ending'],
      properties: {
        title: nonEmptyString,
        items: {
          type: 'array',
          minItems: 3,
          maxItems: 4,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'prompt', 'meta'],
            properties: {
              label: nonEmptyString,
              prompt: nonEmptyString,
              meta: nonEmptyString,
            },
          },
        },
        ending: nonEmptyString,
      },
    },
  },
};

const dailyCopySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'label',
    'decisionTitle',
    'decisionSummary',
    'thresholdReason',
    'observeNext',
  ],
  properties: {
    label: nonEmptyString,
    decisionTitle: nonEmptyString,
    decisionSummary: nonEmptyString,
    thresholdReason: nonEmptyString,
    observeNext: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: nonEmptyString,
    },
  },
};

const evolutionCopySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'implication'],
  properties: {
    title: nonEmptyString,
    description: nonEmptyString,
    implication: nonEmptyString,
  },
};

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'insightId',
    'slug',
    'parentInsightId',
    'previousInsightId',
    'en',
    'zh',
    'ja',
    'dailyState',
    'processUpdate',
  ],
  properties: {
    insightId: {
      type: ['string', 'null'],
    },
    slug: nonEmptyString,
    parentInsightId: {
      type: ['string', 'null'],
    },
    previousInsightId: {
      type: ['string', 'null'],
    },
    en: localizedPageSchema,
    zh: localizedPageSchema,
    ja: localizedPageSchema,
    dailyState: {
      type: 'object',
      additionalProperties: false,
      required: ['en', 'zh', 'ja'],
      properties: {
        en: dailyCopySchema,
        zh: dailyCopySchema,
        ja: dailyCopySchema,
      },
    },
    processUpdate: {
      type: 'object',
      additionalProperties: false,
      required: [
        'stage',
        'content',
        'nextQuestion',
        'observeNext',
      ],
      properties: {
        stage: {
          type: 'string',
          enum: [
            'signal',
            'emerging',
            'accelerating',
            'structural',
            'maturing',
            'uncertain',
            'declining',
          ],
        },
        content: {
          type: 'object',
          additionalProperties: false,
          required: ['en', 'zh', 'ja'],
          properties: {
            en: evolutionCopySchema,
            zh: evolutionCopySchema,
            ja: evolutionCopySchema,
          },
        },
        nextQuestion: {
          type: 'object',
          additionalProperties: false,
          required: ['en', 'zh', 'ja'],
          properties: {
            en: nonEmptyString,
            zh: nonEmptyString,
            ja: nonEmptyString,
          },
        },
        observeNext: {
          type: 'object',
          additionalProperties: false,
          required: ['en', 'zh', 'ja'],
          properties: {
            en: {
              type: 'array',
              minItems: 3,
              maxItems: 4,
              items: nonEmptyString,
            },
            zh: {
              type: 'array',
              minItems: 3,
              maxItems: 4,
              items: nonEmptyString,
            },
            ja: {
              type: 'array',
              minItems: 3,
              maxItems: 4,
              items: nonEmptyString,
            },
          },
        },
      },
    },
  },
};


const PLACEHOLDER_TEXTS = new Set([
  '无字段',
  '沒有欄位',
  '没有字段',
  '未填写',
  '未填寫',
  '待补充',
  '待補充',
  '暂无内容',
  '暫無內容',
  'no field',
  'no fields',
  'missing field',
  'not available',
  'n/a',
  '未入力',
  '項目なし',
  'フィールドなし',
]);

function isMeaningfulText(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !PLACEHOLDER_TEXTS.has(normalized);
}

function findMissingPatternFields(generated) {
  const missing = [];

  for (const language of ['en', 'zh', 'ja']) {
    const pattern = generated?.[language]?.pattern;

    for (const field of [
      'title',
      'before',
      'shift',
      'now',
      'conclusion',
    ]) {
      if (!isMeaningfulText(pattern?.[field])) {
        missing.push(`${language}.pattern.${field}`);
      }
    }
  }

  return missing;
}

async function requestWriter({
  researchDraft,
  candidate,
  matchedProcess,
  retryReason,
}) {
  const sourceIds = (candidate.sources || [])
    .map((source) => source.id)
    .filter(Boolean);

  const instructions = [
    'You are the AI Writer for Insight, a daily world-process cognition product.',
    'Write a complete six-page Insight draft in English, Simplified Chinese, and Japanese.',
    'Every required string must contain meaningful non-whitespace text.',
    'Page 4 is mandatory in all three languages and must contain five distinct fields: title, before, shift, now, and conclusion.',
    'For Page 4: before describes the previous operating model; shift identifies the material change; now describes the current structure; conclusion states the system-level implication.',
    'Never return an empty string or placeholder for Page 4.',
    'Forbidden placeholder values include: 无字段, 没有字段, 待补充, 暂无内容, No field, Missing field, N/A, 未入力, 項目なし, フィールドなし.',
    'If evidence is insufficient to write a Page 4 field, state a cautious evidence-grounded sentence rather than a placeholder.',
    'Do not invent facts, source URLs, publication dates, quotes, or numeric details.',
    'Use only facts present in the supplied candidate and sources.',
    'Do not place URLs, Markdown links, citations, or publisher names in narrative copy.',
    'Evidence sourceIds must use only IDs supplied in the candidate sources.',
    'The first page must be concise and emotionally clear. Do not repeat the same sentence across pages.',
    'Page 2 asks the real structural question. Page 3 separates signals.',
    'Page 5 states one memorable insight. Page 6 gives testable Observe Next items.',
    'Use cautious language when the evidence supports an inference rather than an official conclusion.',
    'Write for a general audience; avoid internal engine jargon in user-facing copy.',
    'This is a draft. Do not claim it is published or approved.',
    retryReason
      ? `A previous attempt was rejected because these fields were empty or placeholders: ${retryReason}. Rewrite the complete draft with meaningful evidence-grounded sentences for every one of them.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const input = {
    researchDraftId: researchDraft.id,
    researchDate: researchDraft.researchDate,
    candidate,
    matchedProcess: matchedProcess || null,
    allowedSourceIds: sourceIds,
  };

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${globalThis.process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: globalThis.process.env.OPENAI_MODEL || 'gpt-5',
      store: false,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: instructions,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(input),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'insight_writer_draft',
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  });

  const raw = await response.text();
  let payload;

  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `OpenAI returned non-JSON (${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        `OpenAI writer failed with ${response.status}.`,
    );
  }

  const outputText = extractOutputText(payload);
  const generated = JSON.parse(outputText);

  return {
    model:
      payload.model ||
      globalThis.process.env.OPENAI_MODEL ||
      'unknown',
    generated,
  };
}

async function callWriter({
  researchDraft,
  candidate,
  matchedProcess,
}) {
  const first = await requestWriter({
    researchDraft,
    candidate,
    matchedProcess,
  });

  const missing = findMissingPatternFields(first.generated);

  if (missing.length === 0) {
    return first;
  }

  const second = await requestWriter({
    researchDraft,
    candidate,
    matchedProcess,
    retryReason: missing.join(', '),
  });

  const stillMissing = findMissingPatternFields(second.generated);

  if (stillMissing.length > 0) {
    const error = new Error(
      `Writer returned an incomplete Page 04 after retry: ${stillMissing.join(', ')}`,
    );
    error.status = 422;
    throw error;
  }

  return second;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, {
      ok: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    if (!globalThis.process.env.OPENAI_API_KEY) {
      return json(res, 500, {
        ok: false,
        error: 'OPENAI_API_KEY is not configured.',
      });
    }

    if (!globalThis.process.env.RESEARCH_API_TOKEN) {
      return json(res, 500, {
        ok: false,
        error: 'RESEARCH_API_TOKEN is not configured.',
      });
    }

    if (
      req.headers?.['x-research-token'] !==
      globalThis.process.env.RESEARCH_API_TOKEN
    ) {
      return json(res, 401, {
        ok: false,
        error: 'Unauthorized.',
      });
    }

    const body = parseBody(req);
    const researchDraft = body.researchDraft || body.draft;
    const candidateId = body.candidateId;

    if (
      !researchDraft?.id ||
      !Array.isArray(researchDraft?.candidates)
    ) {
      return json(res, 400, {
        ok: false,
        error: 'researchDraft with candidates is required.',
      });
    }

    const candidate =
      researchDraft.candidates.find(
        (item) => item.id === candidateId,
      ) || researchDraft.candidates[0];

    if (!candidate) {
      return json(res, 400, {
        ok: false,
        error: 'Candidate was not found.',
      });
    }

    if (!candidate.analysis) {
      return json(res, 422, {
        ok: false,
        error:
          'Candidate must be analyzed by Build011.3 first.',
      });
    }

    if (
      !candidate.analysis.publishThresholdMet &&
      body.force !== true
    ) {
      return json(res, 422, {
        ok: false,
        error:
          'Candidate does not meet the publication threshold.',
        dailyState: candidate.analysis.dailyState,
        warnings: candidate.analysis.warnings,
      });
    }

    const processId =
      candidate.analysis.matchedProcessId ||
      candidate.suggestedProcessId;

    const matchedProcess = processCatalog.find(
      (item) => item.id === processId,
    );

    const { model, generated } = await callWriter({
      researchDraft,
      candidate,
      matchedProcess,
    });

    const writerDraft = buildWriterDraft({
      researchDraft,
      candidate,
      model,
      generated,
      process: matchedProcess,
    });

    const missingAfterBuild = findMissingPatternFields({
      en: writerDraft?.insight?.content?.en,
      zh: writerDraft?.insight?.content?.zh,
      ja: writerDraft?.insight?.content?.ja,
    });

    if (missingAfterBuild.length > 0) {
      return json(res, 422, {
        ok: false,
        error:
          'Writer Draft mapping removed or emptied Page 04 fields.',
        missingFields: missingAfterBuild,
      });
    }

    return json(res, 200, {
      ok: true,
      writerDraft,
    });
  } catch (error) {
    console.error('Writer API failed:', error);

    const status =
      Number.isInteger(error?.status) ? error.status : 500;

    return json(res, status, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown writer error.',
    });
  }
}
