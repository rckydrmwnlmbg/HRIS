async function testShift() {
  const res = await fetch('http://localhost:3000/api/absensi/sync-shift-security', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bulan: 8, tahun: 2026, mode: 'preview' })
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Result:', {
    total_security_rows: data.total_security_rows,
    mismatch_count: data.mismatch_count,
    mismatches_sample: data.mismatches?.slice(0, 2)
  });
}
testShift();
