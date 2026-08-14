const BASE = 'http://localhost:3000';

async function testAll() {
  console.log('Testing full API suite...\n');

  const tests = [
    { name: 'GET /api/dashboard', url: `${BASE}/api/dashboard` },
    { name: 'GET /api/dashboard/jam-kosong?date=2026-08-14', url: `${BASE}/api/dashboard/jam-kosong?date=2026-08-14` },
    { name: 'GET /api/master', url: `${BASE}/api/master` },
    { name: 'GET /api/karyawan?status=aktif&limit=10', url: `${BASE}/api/karyawan?status=aktif&limit=10` },
    { name: 'GET /api/cuti', url: `${BASE}/api/cuti` },
    { name: 'GET /api/check-bagian?sec_cd=3101&date=2026-08-01', url: `${BASE}/api/check-bagian?sec_cd=3101&date=2026-08-01` },
    { name: 'GET /api/laporan/export?type=absensi&bulan=8&tahun=2026&format=json', url: `${BASE}/api/laporan/export?type=absensi&bulan=8&tahun=2026&format=json` },
    { name: 'GET /api/assistant/briefing', url: `${BASE}/api/assistant/briefing` },
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await fetch(t.url);
      if (res.ok) {
        console.log(`✅ ${t.name} (Status: ${res.status})`);
        passed++;
      } else {
        console.error(`❌ ${t.name} (Status: ${res.status})`);
      }
    } catch (e) {
      console.error(`❌ ${t.name} (Error: ${e.message})`);
    }
  }

  console.log(`\nPassed ${passed}/${tests.length} endpoint checks.`);
  if (passed !== tests.length) process.exit(1);
}

testAll();
