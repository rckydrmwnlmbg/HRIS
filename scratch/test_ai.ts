async function testApi() {
  const API_URL = 'https://bandelbanget.xyz/v1/chat/completions';
  const API_KEY = process.env.BANDELBANGET_API_KEY || 'sk-qwen-753ac2e4be15fce1802f744c769e8636ee5632a4a409dba5';
  const MODEL = 'gpt-5.6-luna';

  console.log('Testing AI API endpoint...');
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Halo, test 123' }],
        max_tokens: 50,
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testApi();
