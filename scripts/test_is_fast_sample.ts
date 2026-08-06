import { query } from '../lib/db';

async function testIsFastSample() {
  console.log('================================================================================');
  console.log('2. DEEP DIVE INVESTIGASI IS1, IS2, IS3 (500 SAMPEL ACAK MULTI-TAHUN)');
  console.log('================================================================================\n');

  // Ambil 500 sampel: 200 dari 2026, 200 dari 2025, 100 dari 2024
  const sample500 = await query<any>(`
    SELECT * FROM (
      SELECT TOP 200
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
      WHERE a.DATE_TRANS >= '2026-01-01' AND a.DATE_TRANS <= '2026-07-31'
        AND a.IS1 IS NOT NULL
      
      UNION ALL

      SELECT TOP 200
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
      WHERE a.DATE_TRANS >= '2025-06-01' AND a.DATE_TRANS <= '2025-08-31'
        AND a.IS1 IS NOT NULL

      UNION ALL

      SELECT TOP 100
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
      WHERE a.DATE_TRANS >= '2024-06-01' AND a.DATE_TRANS <= '2024-08-31'
        AND a.IS1 IS NOT NULL
    ) AS s
  `);

  console.log(`Total sample baris didapatkan: ${sample500.length} baris.`);

  // Analisis Nilai IS1, IS2, IS3
  let is1Equals8 = 0;
  let is1EqualsStdJam = 0;
  let is1EqualsJamKerja = 0;
  let is1Equals0 = 0;
  let is1Other = 0;

  let is2Equals0 = 0;
  let is2EqualsOt2 = 0;
  let is2EqualsTot = 0;
  let is2EqualsJamKerjaMinus8 = 0;
  let is2Other = 0;

  let is3Equals0 = 0;
  let is3Other = 0;

  for (const r of sample500) {
    // IS1
    if (r.IS1 === 8) is1Equals8++;
    if (r.IS1 === r.STDJAM) is1EqualsStdJam++;
    if (r.IS1 === r.JAM_KERJA) is1EqualsJamKerja++;
    if (r.IS1 === 0 || r.IS1 === null) is1Equals0++;
    if (r.IS1 !== 8 && r.IS1 !== r.STDJAM && r.IS1 !== r.JAM_KERJA && r.IS1 !== 0) is1Other++;

    // IS2
    if (r.IS2 === 0 || r.IS2 === null) is2Equals0++;
    if (r.IS2 === r.OT_2) is2EqualsOt2++;
    if (r.IS2 === r.T_OT) is2EqualsTot++;
    if (r.IS2 === (r.JAM_KERJA - 8)) is2EqualsJamKerjaMinus8++;
    if (r.IS2 !== 0 && r.IS2 !== null && r.IS2 !== r.OT_2 && r.IS2 !== r.T_OT) is2Other++;

    // IS3
    if (r.IS3 === 0 || r.IS3 === null) is3Equals0++;
    else is3Other++;
  }

  console.log('\n--- EVALUASI STATISTIK 500 SAMPLE ACAK ---');
  console.log(`IS1 == 8: ${is1Equals8} / ${sample500.length} (${(is1Equals8*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS1 == STDJAM: ${is1EqualsStdJam} / ${sample500.length} (${(is1EqualsStdJam*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS1 == JAM_KERJA: ${is1EqualsJamKerja} / ${sample500.length} (${(is1EqualsJamKerja*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS1 == 0: ${is1Equals0}`);
  console.log(`IS1 nilai lain: ${is1Other}`);

  console.log(`\nIS2 == 0: ${is2Equals0} / ${sample500.length} (${(is2Equals0*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 == OT_2: ${is2EqualsOt2} / ${sample500.length} (${(is2EqualsOt2*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 == T_OT: ${is2EqualsTot} / ${sample500.length} (${(is2EqualsTot*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 == (JAM_KERJA - 8): ${is2EqualsJamKerjaMinus8} / ${sample500.length} (${(is2EqualsJamKerjaMinus8*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS2 nilai lain: ${is2Other}`);

  console.log(`\nIS3 == 0: ${is3Equals0} / ${sample500.length} (${(is3Equals0*100/sample500.length).toFixed(2)}%)`);
  console.log(`IS3 nilai lain: ${is3Other}`);

  console.log('\n--- 25 BARIS SAMPLE REPRESENTATIF ---');
  console.table(sample500.slice(0, 25).map(r => ({
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

  // Cek kapan IS2 bernilai > 0
  const is2Rows = sample500.filter(r => r.IS2 !== 0 && r.IS2 !== null);
  if (is2Rows.length > 0) {
    console.log(`\n--- SAMPLE DENGAN IS2 > 0 (${is2Rows.length} baris) ---`);
    console.table(is2Rows.slice(0, 15).map(r => ({
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
      OT_2: r.OT_2
    })));
  }
}

testIsFastSample().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
