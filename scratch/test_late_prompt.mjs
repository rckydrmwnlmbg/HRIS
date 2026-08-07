async function testLatePrompt() {
  const url = 'http://localhost:3000/api/chat';
  
  console.log('Sending message to /api/chat: "Daftar karyawan terlambat hari ini"');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Daftar karyawan terlambat hari ini', history: [] }),
    });

    const data = await res.json();
    console.log('\n--- RESPONSE JSON ---');
    console.log('Text:\n', data.text);
    console.log('SQL:\n', data.sql);
    console.log('Rows count:', data.rows ? data.rows.length : null);
    if (data.rows && data.rows.length > 0) {
      console.log('First 3 rows:', data.rows.slice(0, 3));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testLatePrompt();
