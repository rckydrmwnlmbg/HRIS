async function testBandel() {
  const API_KEY = 'sk-qwen-753ac2e4be15fce1802f744c769e8636ee5632a4a409dba5';

  console.log('--- 1. Testing /v1/models ---');
  try {
    const res = await fetch('https://bandelbanget.xyz/v1/models', {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    console.log('Models Status:', res.status);
    const body = await res.text();
    console.log('Models Body:', body.slice(0, 500));
  } catch (e) {
    console.error('Models err:', e);
  }

  console.log('\n--- 2. Testing Chat with different models ---');
  const testModels = ['gpt-5.6-luna', 'gpt-4o-mini', 'gpt-3.5-turbo', 'qwen-turbo', 'qwen-plus', 'claude-3-haiku'];
  for (const m of testModels) {
    try {
      const res = await fetch('https://bandelbanget.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Halo' }],
          max_tokens: 20
        })
      });
      console.log(`Model ${m} -> Status:`, res.status);
      const text = await res.text();
      console.log(`Body:`, text);
    } catch (e) {
      console.error(`Model ${m} err:`, e);
    }
  }
}

testBandel();
