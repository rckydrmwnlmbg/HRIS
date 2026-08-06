import { query } from '../lib/db';

async function testIsDeepDive() {
  console.log('================================================================================');
  console.log('2. DEEP DIVE INVESTIGASI IS1, IS2, IS3 (500 SAMPLE RANDOM & ANALISIS POLA)');
  console.log('================================================================================\n');

  // Ambil daftar NIK Security
  const secEmployees = await query<any>(`
    SELECT DISTINCT e.EMP_CD
    FROM EMP_TABLE e
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    WHERE UPPER(ISNULL(j.JOB_DESC,'')) LIKE '%SECURITY%'
       OR UPPER(ISNULL(j.JOB_DESC,'')) LIKE '%SATPAM%'
       OR UPPER(ISNULL(s.SEC_DESC,'')) LIKE '%SECURITY%'
       OR UPPER(ISNULL(s.SEC_DESC,'')) LIKE '%SATPAM%'
  `);
  const secNiks = secEmployees.map(r => `'${r.EMP_CD.trim()}'`).join(',');
  const secFilter = secNiks ? `AND a.EMP_CD NOT IN (${secNiks})` : '';

  // 1. Cek berapa banyak baris dengan IS1, IS2, IS3 di database
  const countStats = await query<any>(`
    SELECT 
      COUNT(*) AS TOTAL_ROWS,
      SUM(CASE WHEN IS1 IS NOT NULL AND IS1 <> 0 THEN 1 ELSE 0 END) AS HAS_IS1,
      SUM(CASE WHEN IS2 IS NOT NULL AND IS2 <> 0 THEN 1 ELSE 0 END) AS HAS_IS2,
      SUM(CASE WHEN IS3 IS NOT NULL AND IS3 <> 0 THEN 1 ELSE 0 END) AS HAS_IS3
    FROM TR_ABSEN a
    WHERE 1=1 ${secFilter}
  `);
  console.log('Statistik Keberadaan IS1, IS2, IS3 di Database:');
  console.table(countStats);

  // 2. Ambil 500 Sampel Acak yang punya IS1/IS2/IS3
  const sample500 = await query<any>(`
    SELECT TOP 500
      RTRIM(a.EMP_CD) AS EMP_CD,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      DATENAME(dw, a.DATE_TRANS) AS NAMA_HARI,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      CONVERT(varchar(8), a.WORK_IN, 108) AS WORK_IN,
      CONVERT(varchar(8), a.WORK_OUT, 108) AS WORK_OUT,
      a.JAM_KERJA,
      a.STDJAM,
      a.IS1, a.IS2, a.IS3,
      a.T_OT, a.OT_1, a.OT_2, a.OT_3, a.OT_4
    FROM TR_ABSEN a
    WHERE (a.IS1 IS NOT NULL AND a.IS1 <> 0)
      ${secFilter}
    ORDER BY a.DATE_TRANS DESC, a.EMP_CD
  `);

  console.log(`\nBerhasil mengambil ${sample500.length} sampel baris.`);

  // 3. Analisis Nilai IS1
  let is1EqualsStdJam = 0;
  let is1EqualsJamKerja = 0;
  let is1Equals8 = 0;
  let is1Equals0 = 0;
  let is1Other = 0;

  // Analisis Nilai IS2
  let is2EqualsOt2 = 0;
  let is2EqualsTot = 0;
  let is2EqualsJamKerjaMinus8 = 0;
  let is2Equals0 = 0;
  let is2Other = 0;

  // Analisis Nilai IS3
  let is3Equals0 = 0;
  let is3Other = 0;

  for (const r of sample500) {
    // IS1
    if (r.IS1 === r.STDJAM) is1EqualsStdJam++;
    if (r.IS1 === r.JAM_KERJA) is1EqualsJamKerja++;
    if (r.IS1 === 8) is1Equals8++;
    if (r.IS1 === 0 || r.IS1 === null) is1Equals0++;
    if (r.IS1 !== 8 && r.IS1 !== r.STDJAM && r.IS1 !== r.JAM_KERJA) is1Other++;

    // IS2
    if (r.IS2 === r.OT_2) is2EqualsOt2++;
    if (r.IS2 === r.T_OT) is2EqualsTot++;
    if (r.IS2 === (r.JAM_KERJA - 8)) is2EqualsJamKerjaMinus8++;
    if (r.IS2 === 0 || r.IS2 === null) is2Equals0++;
    if (r.IS2 !== 0 && r.IS2 !== r.OT_2 && r.IS2 !== r.T_OT) is2Other++;

    // IS3
    if (r.IS3 === 0 || r.IS3 === null) is3Equals0++;
    else is3Other++;
  }

  console.log('\n--- HASIL ANALISIS KORELASI 500 SAMPEL ---');
  console.log(`IS1 == 8: ${is1Equals8} / ${sample500.length} (${(is1Equals8*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS1 == STDJAM: ${is1EqualsStdJam} / ${sample500.length} (${(is1EqualsStdJam*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS1 == JAM_KERJA: ${is1EqualsJamKerja} / ${sample500.length} (${(is1EqualsJamKerja*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS1 nilai lain: ${is1Other}`);

  console.log(`\nIS2 == 0: ${is2Equals0} / ${sample500.length} (${(is2Equals0*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 == OT_2: ${is2EqualsOt2} / ${sample500.length} (${(is2EqualsOt2*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 == T_OT: ${is2EqualsTot} / ${sample500.length} (${(is2EqualsTot*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 == (JAM_KERJA - 8): ${is2EqualsJamKerjaMinus8} / ${sample500.length} (${(is2EqualsJamKerjaMinus8*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 nilai lain: ${is2Other}`);

  console.log(`\nIS3 == 0: ${is3Equals0} / ${sample500.length} (${(is3Equals0*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS3 nilai lain: ${is3Other}`);

  // Tampilkan 20 baris sampel beragam
  console.log('\n--- 20 SAMPEL NYATA DENGAN BERBAGAI STATUS & JAM KERJA ---');
  console.table(sample500.slice(0, 20).map(r => ({
    EMP_CD: r.EMP_CD,
    DATE: r.DATE_TRANS,
    STATUS: r.STATUS_HARI,
    IN: r.WORK_IN,
    OUT: r.WORK_OUT,
    JAM_KERJA: r.JAM_KERJA,
    STDJAM: r.STDJAM,
    T_OT: r.T_OT,
    IS1: r.IS1,
    IS2: r.IS2,
    IS3: r.IS3,
    OT_1: r.OT_1,
    OT_2: r.OT_2
  })));

  // Cek sampel di mana IS2 <> 0
  const sampleWithIs2 = sample500.filter(r => r.IS2 !== 0 && r.IS2 !== null);
  if (sampleWithIs2.length > 0) {
    console.log(`\n--- SAMPEL DI MANA IS2 <> 0 (${sampleWithIs2.length} baris) ---`);
    console.table(sampleWithIs2.slice(0, 15).map(r => ({
      EMP_CD: r.EMP_CD,
      DATE: r.DATE_TRANS,
      STATUS: r.STATUS_HARI,
      JAM_KERJA: r.JAM_KERJA,
      STDJAM: r.STDJAM,
      T_OT: r.T_OT,
      IS1: r.IS1,
      IS2: r.IS2,
      IS3: r.IS3,
      OT_1: r.OT_1,
      OT_2: r.OT_2,
      OT_3: r.OT_3,
      OT_4: r.OT_4
    })));
  }

  // Cek sampel di mana IS3 <> 0
  const sampleWithIs3 = await query<any>(`
    SELECT TOP 15
      RTRIM(a.EMP_CD) AS EMP_CD,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      a.JAM_KERJA,
      a.STDJAM,
      a.IS1, a.IS2, a.IS3,
      a.T_OT, a.OT_1, a.OT_2, a.OT_3, a.OT_4
    FROM TR_ABSEN a
    WHERE a.IS3 IS NOT NULL AND a.IS3 <> 0
      ${secFilter}
    ORDER BY a.DATE_TRANS DESC
  `);
  if (sampleWithIs3.length > 0) {
    console.log(`\n--- SAMPEL DI MANA IS3 <> 0 (${sampleWithIs3.length} baris) ---`);
    console.table(sampleWithIs3);
  }
}

testIsDeepDive().then(() => process.exit(0)).catch(err => {
  console.error('Error saat deep dive IS123:', err);
  process.exit(1);
});
