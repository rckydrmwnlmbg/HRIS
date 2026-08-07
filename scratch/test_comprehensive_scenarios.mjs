import http from 'http';

const SCENARIOS = [
  { name: '1. Keterlambatan Hari Ini', prompt: 'Daftar karyawan terlambat hari ini' },
  { name: '2. Total Karyawan Aktif', prompt: 'Berapa total karyawan aktif saat ini?' },
  { name: '3. Alpha Hari Ini', prompt: 'Siapa saja yang alpha hari ini?' },
  { name: '4. Lembur Tertinggi', prompt: 'Siapa karyawan dengan jam lembur terbanyak?' },
  { name: '5. Profil & Gaji Karyawan', prompt: 'Berapa gaji dan status karyawan Widya Etika?' },
  { name: '6. Bagian / Departemen', prompt: 'Berapa jumlah karyawan di bagian HRD dan Warehouse?' },
  { name: '7. Performa Karyawan', prompt: 'Tolong list performa karyawan terbaik kategori ALL IN dan HARIAN' },
  { name: '8. Data Cuti', prompt: 'Siapa saja yang tercatat cuti?' },
  { name: '9. Konseptual HR', prompt: 'Apa perbedaan sistem lembur ALL IN dan Harian di PT TMNB?' },
  { name: '10. Sapaan Ramah', prompt: 'Halo Viditii, selamat pagi! Apa saja yang bisa kamu bantu?' },
];

async function testPrompt(scenario) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ message: scenario.prompt, history: [] });
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 25000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ success: true, scenario, data });
          } catch (err) {
            resolve({ success: false, scenario, error: 'JSON parse error: ' + body.slice(0, 100) });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({ success: false, scenario, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, scenario, error: 'Timeout after 25s' });
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Testing all scenarios against http://localhost:3000/api/chat ...\n');
  for (const s of SCENARIOS) {
    console.log(`\n======================================================`);
    console.log(`[SCENARIO] ${s.name}`);
    console.log(`[USER PROMPT]: "${s.prompt}"`);
    const start = Date.now();
    const result = await testPrompt(s);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    if (!result.success) {
      console.log(`[RESULT: FAILED] in ${elapsed}s:`, result.error);
    } else {
      console.log(`[RESULT: SUCCESS] in ${elapsed}s`);
      if (result.data.sql) {
        console.log(`[SQL GENERATED]:\n${result.data.sql}`);
      }
      console.log(`[ROWS RETURNED]: ${result.data.rows ? result.data.rows.length : 'none'}`);
      console.log(`[AI RESPONSE TEXT]:\n${result.data.text}`);
    }
  }
}

main();
