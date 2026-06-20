exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { system, userInput } = JSON.parse(event.body);
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SILICONFLOW_API_KEY not configured. Get a free key at cloud.siliconflow.cn' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const messages = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  if (userInput) {
    messages.push({ role: 'user', content: userInput });
  }

  try {
    const resp = await fetch('https://api.siliconflow.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V2.5',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        statusCode: resp.status,
        body: JSON.stringify({ error: `SiliconFlow API error: ${errText}` }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const data = await resp.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};