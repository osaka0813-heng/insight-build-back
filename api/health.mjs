export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed. Use GET.',
    });
  }

  return res.status(200).json({
    ok: true,
    service: 'insight-build-back',
    version: '012.4-alpha',
    checkedAt: new Date().toISOString(),
  });
}
