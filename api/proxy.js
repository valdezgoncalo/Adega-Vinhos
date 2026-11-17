export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  const allowedOrigins = [
    'https://valdezgoncalo.github.io',
    'https://adega-vinhos.vercel.app',
    'https://adega-prestige-preview.vercel.app',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];
  const origin = req.headers.origin || '';
  if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server.' });
  }

  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return res.status(400).json({ error: 'Invalid request body' });
    if (input.model !== 'claude-haiku-4-5') return res.status(400).json({ error: 'Unsupported model' });
    if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 10) return res.status(400).json({ error: 'Invalid messages array' });
    const maxTokens = Number(input.max_tokens);
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 2000) return res.status(400).json({ error: 'Invalid max_tokens (1–2000)' });
    for (const message of input.messages) {
      if (!message || message.role !== 'user' || !(typeof message.content === 'string' || Array.isArray(message.content))) return res.status(400).json({ error: 'Only user messages are supported' });
      if (typeof message.content === 'string' && message.content.length > 30000) return res.status(413).json({ error: 'Message too large' });
      if (Array.isArray(message.content)) {
        if (message.content.length > 5) return res.status(400).json({ error: 'Too many content blocks' });
        for (const block of message.content) {
          if (block?.type === 'text' && typeof block.text === 'string' && block.text.length <= 30000) continue;
          if (block?.type === 'image' && block.source?.type === 'base64' && ['image/jpeg','image/png','image/webp','image/gif'].includes(block.source.media_type) && typeof block.source.data === 'string' && block.source.data.length <= 8000000) continue;
          return res.status(400).json({ error: 'Unsupported content block' });
        }
      }
    }
    const body = JSON.stringify({ model: input.model, max_tokens: maxTokens, messages: input.messages });
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid request or proxy error', details: err.message });
  }}
