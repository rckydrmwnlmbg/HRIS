async function testQuestions() {
  const questions = [
    'Tampilkan 5 line produksi dan jumlah karyawannya',
    'Siapa saja karyawan yang berstatus cuti atau sakit?',
    'Berapa jumlah karyawan tetap vs kontrak?'
  ];

  for (const q of questions) {
    console.log(`\n===================\nTesting: "${q}"`);
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q }),
    });
    const data = await res.json();
    console.log('Text:', data.text);
    console.log('SQL:\n', data.sql);
    console.log('Sample Rows:', data.rows?.slice(0, 3));
    console.log('Error:', data.error);
  }
}

testQuestions();
