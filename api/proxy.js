module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not set in Vercel env' });

  const { prompt } = req.body || {};
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
    res.status(200).json(await resp.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
