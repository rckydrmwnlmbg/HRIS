/**
 * Test: POST generate + apply, verify UPDATE persisted
 */
const BASE = 'http://localhost:3000';

async function test() {
  // 1. Get sections
  const masterRes = await fetch(`${BASE}/api/master`);
  const master = await masterRes.json();
  const lineSec = master.seksi.find(s => s.SEC_DESC?.toUpperCase().includes('LINE')) || master.seksi[0];
  const secCd = lineSec.SEC_CD;
  console.log(`Section: ${secCd} (${lineSec.SEC_DESC})`);

  // 2. GET current data for a date
  const testDate = '2026-08-07'; // Friday
  const getRes = await fetch(`${BASE}/api/check-bagian?sec_cd=${encodeURIComponent(secCd)}&date=${testDate}`);
  const records = await getRes.json();
  console.log(`\nGET ${testDate}: ${records.length} employees`);

  // Show first 5 before
  console.log('\nBEFORE (first 5):');
  records.slice(0, 5).forEach(r => {
    console.log(`  ${r.NIK} | ${r.NAMA} | IN: ${r.MASUK || '--'} | OUT: ${r.PULANG || '--'} | ${r.STATUS_DISPLAY}`);
  });

  // 3. Prepare corrections: randomize OUT 18:00-18:10
  const corrections = records.slice(0, 3).map(r => {
    const randomMin = Math.floor(Math.random() * 11);
    const outTime = `18:${String(randomMin).padStart(2, '0')}:00`;
    return {
      EMP_CD: r.NIK,
      WORK_IN: r.MASUK_FULL ? `${testDate}T${r.MASUK_FULL}` : `${testDate}T07:00:00`,
      WORK_OUT: `${testDate}T${outTime}`,
    };
  });

  console.log('\nCORRECTIONS to apply:');
  corrections.forEach(c => {
    const outMatch = c.WORK_OUT?.match(/T(\d{2}:\d{2}:\d{2})/);
    console.log(`  ${c.EMP_CD} → OUT: ${outMatch ? outMatch[1] : c.WORK_OUT}`);
  });

  // 4. POST
  console.log('\nSending POST...');
  const postRes = await fetch(`${BASE}/api/check-bagian`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sec_cd: secCd, date: testDate, corrections }),
  });
  const postResult = await postRes.json();
  console.log(`POST result: ${JSON.stringify(postResult)}`);

  // 5. GET again to verify
  console.log('\nVerifying with GET...');
  const verifyRes = await fetch(`${BASE}/api/check-bagian?sec_cd=${encodeURIComponent(secCd)}&date=${testDate}`);
  const verifyRecords = await verifyRes.json();

  // Show corrected employees
  const correctedNiks = new Set(corrections.map(c => c.EMP_CD));
  console.log('\nAFTER (corrected employees):');
  verifyRecords.filter(r => correctedNiks.has(r.NIK)).forEach(r => {
    console.log(`  ${r.NIK} | ${r.NAMA} | IN: ${r.MASUK || '--'} | OUT: ${r.PULANG || '--'} | ${r.STATUS_DISPLAY}`);
  });

  console.log('\n=== TEST COMPLETE ===');
}

test().catch(err => console.error('FATAL:', err.message));
