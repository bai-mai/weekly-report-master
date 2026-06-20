exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const action = event.queryStringParameters?.action;
  const body = JSON.parse(event.body || '{}');

  // === Action: Generate report ===
  if (!action || action === 'generate') {
    return await handleGenerate(body);
  }

  // === Action: Generate activation code ===
  if (action === 'gen-code') {
    return await handleGenCode(body);
  }

  // === Action: Verify activation code ===
  if (action === 'verify-code') {
    return await handleVerifyCode(body);
  }

  return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
};

async function handleGenerate(body) {
  const { prompt } = body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured. Get a free key at platform.deepseek.com' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const messages = [];
  if (prompt?.system) messages.push({ role: 'system', content: prompt.system });
  if (prompt?.userInput) messages.push({ role: 'user', content: prompt.userInput });

  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: 1024 })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: resp.status, body: JSON.stringify({ error: `DeepSeek API error: ${errText}` }), headers: { 'Content-Type': 'application/json' } };
    }
    const data = await resp.json();
    return { statusCode: 200, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }), headers: { 'Content-Type': 'application/json' } };
  }
}

async function handleGenCode(body) {
  const { key } = body;
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) return { statusCode: 500, body: JSON.stringify({ error: 'MASTER_KEY not configured' }), headers: { 'Content-Type': 'application/json' } };
  if (!key || key !== masterKey) return { statusCode: 403, body: JSON.stringify({ error: 'Invalid master key' }), headers: { 'Content-Type': 'application/json' } };

  const crypto = await import('crypto');
  const buf = crypto.randomBytes(6).toString('hex').toUpperCase();
  const codePrefix = `WR-${buf.substring(0,4)}-${buf.substring(4)}`;
  const sig = crypto.createHmac('sha256', masterKey).update(codePrefix).digest('hex').substring(0, 8).toUpperCase();
  const fullCode = `${codePrefix}-${sig}`;

  return { statusCode: 200, body: JSON.stringify({ code: fullCode }), headers: { 'Content-Type': 'application/json' } };
}

async function handleVerifyCode(body) {
  const { code } = body;
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) return { statusCode: 500, body: JSON.stringify({ valid: false, error: 'MASTER_KEY not configured' }), headers: { 'Content-Type': 'application/json' } };
  if (!code) return { statusCode: 200, body: JSON.stringify({ valid: false }), headers: { 'Content-Type': 'application/json' } };

  const parts = code.split('-');
  if (parts.length < 5) return { statusCode: 200, body: JSON.stringify({ valid: false }), headers: { 'Content-Type': 'application/json' } };

  const codePrefix = parts.slice(0, 3).join('-');
  const sig = parts.slice(3).join('-');

  const crypto = await import('crypto');
  const expected = crypto.createHmac('sha256', masterKey).update(codePrefix).digest('hex').substring(0, 8).toUpperCase();

  return { statusCode: 200, body: JSON.stringify({ valid: sig === expected }), headers: { 'Content-Type': 'application/json' } };
}