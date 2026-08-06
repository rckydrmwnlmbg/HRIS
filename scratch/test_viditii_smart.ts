async function testViditiiAI() {
  const baseUrl = 'http://localhost:3000/api/chat';

  const tests = [
    {
      name: 'Navigation: absensi page redirect',
      message: 'saya ingin lihat absensi bulan ini secara lengkap',
    },
    {
      name: 'Adaptive: per bagian grouping',
      message: 'berapa jumlah karyawan aktif per bagian?',
    },
    {
      name: 'Adaptive: bulan lalu',
      message: 'rekap alpha bulan lalu',
    },
    {
      name: 'Navigation + Data: lembur redirect',
      message: 'dimana saya bisa lihat data lembur?',
    },
    {
      name: 'Web Search: regulasi',
      message: 'apa aturan cuti tahunan menurut UU ketenagakerjaan?',
    },
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: "${test.name}"`);
    console.log(`Message: "${test.message}"`);
    console.log('-'.repeat(60));

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: test.message, history: [] }),
      });
      const data = await res.json();

      console.log('Text:', data.text?.slice(0, 300) || '(empty)');
      if (data.sql) console.log('SQL:', data.sql.slice(0, 200));
      if (data.rows) console.log('Rows count:', data.rows.length);
      if (data.error) console.log('Error:', data.error);

      // Check for navigation hints
      const hasNavHint = data.text?.includes('/') && (
        data.text.includes('/daily') || data.text.includes('/absensi') || 
        data.text.includes('/lembur') || data.text.includes('/karyawan') ||
        data.text.includes('/laporan') || data.text.includes('/dashboard') ||
        data.text.includes('/cuti')
      );
      console.log('Has navigation hint:', hasNavHint ? 'YES' : 'NO');

    } catch (err: any) {
      console.error('Error:', err.message);
    }
  }
}

testViditiiAI();
