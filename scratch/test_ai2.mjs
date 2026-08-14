async function test() {
  const url = process.env.AI_BASE_URL || 'https://bandelbanget.xyz/v1/chat/completions';
  const apiKey = process.env.AI_API_KEY || 'sk-qwen-753ac2e4be15fce1802f744c769e8636ee5632a4a409dba5';
  
  console.log('URL:', url);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL_TEXT || 'deepseek-v4-pro',
        messages: [
          { role: 'assistant', content: 'Halo Widya! Ada yang bisa kubantu hari ini?' },
          { role: 'user', content: 'Jam berapa sekarang ?' }
        ],
        max_tokens: 2500,
        temperature: 0.1
      })
    });
    
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
