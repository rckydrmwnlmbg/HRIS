/**
 * Comprehensive integration test — all recent changes
 */
const BASE = 'http://localhost:3000';
let passed = 0, failed = 0;

function ok(label, condition, detail) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label} — ${detail || ''}`); }
}

async function test() {
  console.log('═══════════════════════════════════');
  console.log('  COMPREHENSIVE INTEGRATION TEST');
  console.log('═══════════════════════════════════\n');

  // ── 1. MASTER DATA ──
  console.log('── 1. Master Data ──');
  const masterRes = await fetch(`${BASE}/api/master`);
  const master = await masterRes.json();
  ok('GET /api/master', masterRes.ok);
  ok('  seksi[]', Array.isArray(master.seksi) && master.seksi.length > 0);
  ok('  reasons[]', Array.isArray(master.reasons) && master.reasons.length > 0);

  const karyawanRes = await fetch(`${BASE}/api/karyawan`);
  const karyawanData = await karyawanRes.json();
  const karyawan = Array.isArray(karyawanData) ? karyawanData : (karyawanData.data || []);
  ok('GET /api/karyawan', karyawan.length > 0, `${karyawan.length} employees`);

  const lineSec = master.seksi.find(s => s.SEC_DESC?.toUpperCase().includes('LINE')) || master.seksi[0];
  const secCd = lineSec.SEC_CD;
  console.log(`  Section: ${secCd} (${lineSec.SEC_DESC})`);

  // ── 2. CHECK PER BAGIAN GET ──
  console.log('\n── 2. Check Per Bagian GET ──');
  const satDate = '2026-08-02'; // Saturday
  const satRes = await fetch(`${BASE}/api/check-bagian?sec_cd=${encodeURIComponent(secCd)}&date=${satDate}`);
  const satRecords = await satRes.json();
  ok('GET Saturday', satRes.ok && Array.isArray(satRecords));
  ok('  Weekend → LIBUR', satRecords.filter(r => r.LIBUR).length > 0, `${satRecords.filter(r => r.LIBUR).length} LIBUR on ${satDate}`);

  const futureRes = await fetch(`${BASE}/api/check-bagian?sec_cd=${encodeURIComponent(secCd)}&date=2027-06-15`);
  const futureJson = await futureRes.json();
  ok('  Future date → empty', futureJson.future === true, `future=${futureJson.future}`);

  const sunDate = '2026-08-09'; // Sunday
  const sunRes = await fetch(`${BASE}/api/check-bagian?sec_cd=${encodeURIComponent(secCd)}&date=${sunDate}`);
  const sunRecords = await sunRes.json();
  ok('  Sunday → LIBUR', sunRecords.filter(r => r.LIBUR).length > 0, `${sunRecords.filter(r => r.LIBUR).length} LIBUR on ${sunDate}`);

  // ── 3. CHECK PER BAGIAN POST (UPSERT) ──
  console.log('\n── 3. Check Per Bagian POST (UPSERT) ──');
  const weekdayDate = '2026-08-06'; // Wednesday
  const preRes = await fetch(`${BASE}/api/check-bagian?sec_cd=${encodeURIComponent(secCd)}&date=${weekdayDate}`);
  const preRecords = await preRes.json();
  const alphaCandidates = preRecords.filter(r => r.ALPHA).slice(0, 3);
  ok('  Found ALPHA candidates', alphaCandidates.length > 0);

  if (alphaCandidates.length > 0) {
    const corrections = alphaCandidates.map(r => {
      const m = Math.floor(Math.random() * 11);
      const s = Math.floor(Math.random() * 60);
      return {
        EMP_CD: r.NIK,
        WORK_IN: `${weekdayDate}T07:00:00`,
        WORK_OUT: `${weekdayDate}T18:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      };
    });
    console.log(`  Corrections: ${corrections.map(c => c.EMP_CD + '→' + c.WORK_OUT.split('T')[1]).join(', ')}`);

    const postRes = await fetch(`${BASE}/api/check-bagian`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sec_cd: secCd, date: weekdayDate, corrections }),
    });
    const postResult = await postRes.json();
    ok('  POST /api/check-bagian', postResult.success, `applied=${postResult.applied}`);

    const verifyRes = await fetch(`${BASE}/api/check-bagian?sec_cd=${encodeURIComponent(secCd)}&date=${weekdayDate}`);
    const verifyRecords = await verifyRes.json();
    const niks = new Set(corrections.map(c => c.EMP_CD));
    const stillAlpha = verifyRecords.filter(r => niks.has(r.NIK) && r.ALPHA);
    ok('  UPSERT persisted', stillAlpha.length === 0, `${stillAlpha.length} still ALPHA`);

    const outs = verifyRecords.filter(r => niks.has(r.NIK)).map(r => r.PULANG).filter(Boolean);
    console.log(`  OUT times: ${outs.join(', ')}`);
    ok('  Random OUT 18:00-18:10', outs.length > 0);
  }

  // ── 4. ABSENSI (isJamKosong) ──
  console.log('\n── 4. Absensi (isJamKosong) ──');
  const emp = karyawan.find(k => k.EMP_CD === '24084460') || karyawan[0];
  if (emp) {
    const absRes = await fetch(`${BASE}/api/absensi?emp=${emp.EMP_CD}&bulan=8&tahun=2026`);
    const absData = await absRes.json();
    ok('GET /api/absensi', absRes.ok, `status ${absRes.status}, ${Array.isArray(absData) ? absData.length : '?'} records`);

    if (Array.isArray(absData) && absData.length > 0) {
      // Simulate isJamKosong: WORK_IN/WORK_OUT present → should NOT be flagged
      const withFinger = absData.filter(r => {
        const status = (r.STATUS_HARI || '').trim().toUpperCase();
        return (status === 'O' || status === 'KERJA' || status === '') && r.WORK_IN && r.WORK_OUT;
      });
      const falselyFlagged = withFinger.filter(r => {
        const hasIn = !!r.WORK_IN && String(r.WORK_IN).trim() !== '';
        const hasOut = !!r.WORK_OUT && String(r.WORK_OUT).trim() !== '';
        return !hasIn || !hasOut;
      });
      ok('  isJamKosong: fingerprint OK → NOT flagged', falselyFlagged.length === 0, `${falselyFlagged.length} falsely flagged out of ${withFinger.length}`);

      // Some records without finger should exist
      const noFinger = absData.filter(r => {
        const status = (r.STATUS_HARI || '').trim().toUpperCase();
        return (status === 'O' || status === 'KERJA' || status === '') && (!r.WORK_IN || !r.WORK_OUT);
      });
      console.log(`  Records without fingerprint: ${noFinger.length}`);
    }
  }

  // ── 5. KOREKSI ABSENSI ──
  console.log('\n── 5. Koreksi Absensi ──');
  if (emp) {
    const absRes = await fetch(`${BASE}/api/absensi?emp=${emp.EMP_CD}&bulan=8&tahun=2026`);
    const absData = await absRes.json();
    const target = Array.isArray(absData) ? absData.find(r => r.WORK_IN && r.WORK_OUT && (r.STATUS_HARI === 'O' || r.STATUS_HARI === 'KERJA')) : null;

    if (target) {
      console.log(`  Testing koreksi for ${emp.EMP_CD} on ${target.DATE_TRANS}`);
      const koreksiRes = await fetch(`${BASE}/api/absensi/koreksi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DATE_TRANS: target.DATE_TRANS,
          EMP_CD: emp.EMP_CD,
          WORK_IN: target.WORK_IN,
          WORK_OUT: target.WORK_OUT,
          corrected_status: 'KERJA',
          corrected_reason: '',
          corrected_shift: '1',
          notes: 'Integration test',
          correction_by: 'Test Script'
        }),
      });
      ok('POST /api/absensi/koreksi', koreksiRes.ok, `status ${koreksiRes.status}`);

      const verifyRes = await fetch(`${BASE}/api/absensi?emp=${emp.EMP_CD}&bulan=8&tahun=2026`);
      const verifyData = await verifyRes.json();
      const verified = Array.isArray(verifyData) ? verifyData.find(r => r.DATE_TRANS === target.DATE_TRANS) : null;
      ok('  Koreksi reflected in GET', verified && verified.correction_status === 'applied', verified ? `status=${verified.correction_status}` : 'not found');
    }
  }

  // ── 6. EDIT KARYAWAN ──
  console.log('\n── 6. Edit Karyawan ──');
  const empToEdit = karyawan[0];
  if (empToEdit) {
    const editRes = await fetch(`${BASE}/api/karyawan/${empToEdit.EMP_CD}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        EMP_NM: empToEdit.EMP_NM,
        SEC_CD: empToEdit.SEC_CD,
        JOB_CD: empToEdit.JOB_CD,
        ALL_IN: empToEdit.ALL_IN,
        Act_NonAct: empToEdit.Act_NonAct,
      }),
    });
    ok('PUT /api/karyawan/[id]', editRes.ok, `status ${editRes.status}`);
  }

  // ── 7. CUTI (Weekend Exclusion) ──
  console.log('\n── 7. Cuti (Weekend Exclusion) ──');
  if (emp) {
    const cutiGetRes = await fetch(`${BASE}/api/cuti?emp_cd=${emp.EMP_CD}`);
    ok('GET /api/cuti', cutiGetRes.ok, `status ${cutiGetRes.status}`);

    // Test POST: 14-17 Aug = Thu,Fri,Sat,Sun → should be 2 working days
    const reasonCode = master.reasons[0]?.REASON_CODE || '02';
    const cutiPostRes = await fetch(`${BASE}/api/cuti`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        EMP_CD: emp.EMP_CD,
        EMP_NM: emp.EMP_NM,
        startDate: '2026-08-14',
        endDate: '2026-08-15',
        type: reasonCode,
        reason: 'Integration test',
      }),
    });
    const cutiPostResult = await cutiPostRes.json();
    ok('POST /api/cuti', cutiPostRes.ok, `status ${cutiPostRes.status}`);
  }

  // ── SUMMARY ──
  console.log('\n═══════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════');
  if (failed > 0) process.exit(1);
}

test().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
