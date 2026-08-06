async function testChatEndpoint() {
  console.log('--- 1. Testing GET /api/chat (Suggestions) ---');
  try {
    const getRes = await fetch('http://localhost:3000/api/chat');
    console.log('GET Status:', getRes.status);
    const getData = await getRes.json();
    console.log('Suggestions:', getData);
  } catch (err) {
    console.error('GET Error:', err);
  }

  console.log('\n--- 2. Testing POST /api/chat (Message) ---');
  try {
    const postRes = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Berapa total karyawan aktif saat ini?' }),
    });
    console.log('POST Status:', postRes.status);
    const postData = await postRes.json();
    console.log('POST Response Data:', postData);
  } catch (err) {
    console.error('POST Error:', err);
  }
}

testChatEndpoint();
