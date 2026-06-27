exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const action = event.queryStringParameters?.action;
  const body = JSON.parse(event.body || '{}');
  if (!action || action === 'generate') return await handleGenerate(body);
  if (action === 'gen-code') return await handleGenCode(body);
  if (action === 'verify-code') return await handleVerifyCode(body);
  return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
};

async function handleGenerate(body) {
  const { prompt } = body;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }), headers: { 'Content-Type': 'application/json' } };
  const messages = [];
  if (prompt?.system) messages.push({ role: 'system', content: prompt.system });
  if (prompt?.userInput) messages.push({ role: 'user', content: prompt.userInput });
  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: 1024 })
    });
    if (!resp.ok) return { statusCode: resp.status, body: JSON.stringify({ error: 'DeepSeek API error: ' + await resp.text() }), headers: { 'Content-Type': 'application/json' } };
    return { statusCode: 200, body: JSON.stringify(await resp.json()), headers: { 'Content-Type': 'application/json' } };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }), headers: { 'Content-Type': 'application/json' } };
  }
}

async function handleGenCode(body) {
  const { key, type } = body;
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) return { statusCode: 500, body: JSON.stringify({ error: 'MASTER_KEY not configured' }), headers: { 'Content-Type': 'application/json' } };
  if (!key || key !== masterKey) return { statusCode: 403, body: JSON.stringify({ error: 'Invalid master key' }), headers: { 'Content-Type': 'application/json' } };
  const codeType = type === 'usage' ? 'usage' : 'pro';
  const prefix = codeType === 'pro' ? 'WR' : 'WU';
  const { randomBytes, createHmac } = await import('crypto');
  const buf = randomBytes(6).toString('hex').toUpperCase();
  const codeBody = prefix + '-' + buf.substring(0,4) + '-' + buf.substring(4);
  const sig = createHmac('sha256', masterKey).update(codeBody + ':' + codeType).digest('hex').substring(0, 8).toUpperCase();
  return { statusCode: 200, body: JSON.stringify({ code: codeBody + '-' + sig, type: codeType }), headers: { 'Content-Type': 'application/json' } };
}

async function handleVerifyCode(body) {
  const { code } = body;
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) return { statusCode: 500, body: JSON.stringify({ valid: false }), headers: { 'Content-Type': 'application/json' } };
  if (!code) return { statusCode: 200, body: JSON.stringify({ valid: false }), headers: { 'Content-Type': 'application/json' } };
  const prefix = code.startsWith('WU-') ? 'WU' : code.startsWith('WR-') ? 'WR' : null;
  if (!prefix) return { statusCode: 200, body: JSON.stringify({ valid: false }), headers: { 'Content-Type': 'application/json' } };
  const codeType = prefix === 'WR' ? 'pro' : 'usage';
  const parts = code.split('-');
  if (parts.length < 5) return { statusCode: 200, body: JSON.stringify({ valid: false }), headers: { 'Content-Type': 'application/json' } };
  const codeBody = parts.slice(0, 3).join('-');
  const sig = parts.slice(3).join('-');
  const { createHmac } = await import('crypto');
  const expected = createHmac('sha256', masterKey).update(codeBody + ':' + codeType).digest('hex').substring(0, 8).toUpperCase();
  return { statusCode: 200, body: JSON.stringify({ valid: sig === expected, type: codeType }), headers: { 'Content-Type': 'application/json' } };
}
