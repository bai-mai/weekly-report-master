const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const action = req.query.action;
  const body = req.body || {};

  if (!action || action === 'generate') return await handleGenerate(body, res);
  if (action === 'gen-code') return await handleGenCode(body, res);
  if (action === 'verify-code') return await handleVerifyCode(body, res);

  res.status(400).json({ error: 'Unknown action' });
};

async function handleGenerate(body, res) {
  const { prompt } = body;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  const messages = [];
  if (prompt?.system) messages.push({ role: 'system', content: prompt.system });
  if (prompt?.userInput) messages.push({ role: 'user', content: prompt.userInput });

  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: 1024 })
    });
    if (!resp.ok) return res.status(resp.status).json({ error: 'DeepSeek API error' });
    const data = await resp.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleGenCode(body, res) {
  const { key, type } = body;
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) return res.status(500).json({ error: 'MASTER_KEY not configured' });
  if (!key || key !== masterKey) return res.status(403).json({ error: 'Invalid master key' });

  const codeType = type === 'usage' ? 'usage' : 'pro';
  const prefix = codeType === 'pro' ? 'WR' : 'WU';
  const buf = crypto.randomBytes(6).toString('hex').toUpperCase();
  const codeBody = `${prefix}-${buf.substring(0,4)}-${buf.substring(4)}`;
  const sig = crypto.createHmac('sha256', masterKey).update(codeBody + ':' + codeType).digest('hex').substring(0, 8).toUpperCase();
  res.status(200).json({ code: codeBody + '-' + sig, type: codeType });
}

async function handleVerifyCode(body, res) {
  const { code } = body;
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) return res.status(500).json({ valid: false });
  if (!code) return res.status(200).json({ valid: false });

  const prefix = code.startsWith('WU-') ? 'WU' : code.startsWith('WR-') ? 'WR' : null;
  if (!prefix) return res.status(200).json({ valid: false });
  
  const codeType = prefix === 'WR' ? 'pro' : 'usage';
  const parts = code.split('-');
  if (parts.length < 5) return res.status(200).json({ valid: false });

  const codeBody = parts.slice(0, 3).join('-');
  const sig = parts.slice(3).join('-');
  const expected = crypto.createHmac('sha256', masterKey).update(codeBody + ':' + codeType).digest('hex').substring(0, 8).toUpperCase();
  res.status(200).json({ valid: sig === expected, type: codeType });
}
