import { query } from '../lib/db';

async function runInvestigation() {
  console.log('================================================================================');
  console.log('🔬 INVESTIGASI FORMULA MURNI INUS (DATA FORENSIK SELURUH HISTORIS)');
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
  const secFilter = secNiks ? `AND RTRIM(a.EMP_CD) NOT IN (${secNiks})` : '';

  console.log(`Daftar NIK Security dikecualikan: ${secEmployees.length} orang\n`);

  // -----------------------------------------------------------------------------
  // 1. INVESTIGASI STDJAM
  // -----------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('1. DISTRIBUSI POLA STDJAM (NON-SECURITY)');
  console.log('--------------------------------------------------------------------------------');

  const stdJamOverall = await query<any>(`
    SELECT 
      RTRIM(ISNULL(a.STATUS_HARI, '')) AS STATUS_HARI,
      DATENAME(dw, a.DATE_TRANS) AS NAMA_HARI,
      DATEPART(WEEKDAY, a.DATE_TRANS) AS HARI_NUM,
      a.STDJAM,
      COUNT(*) AS JUMLAH_BARIS
    FROM TR_ABSEN a
    WHERE a.STDJAM IS NOT NULL
      ${secFilter}
    GROUP BY RTRIM(ISNULL(a.STATUS_HARI, '')), DATENAME(dw, a.DATE_TRANS), DATEPART(WEEKDAY, a.DATE_TRANS), a.STDJAM
    ORDER BY STATUS_HARI, HARI_NUM, JUMLAH_BARIS DESC
  `);
  console.table(stdJamOverall);

  // Cek tren STDJAM per Tahun (2022 s.d 2026)
  console.log('\n--- Tren STDJAM per Tahun (Senin s.d Sabtu) ---');
  const stdJamPerTahun = await query<any>(`
    SELECT 
      YEAR(a.DATE_TRANS) AS TAHUN,
      DATENAME(dw, a.DATE_TRANS) AS HARI,
      a.STDJAM,
      COUNT(*) AS JUMLAH
    FROM TR_ABSEN a
    WHERE RTRIM(a.STATUS_HARI) = 'KERJA'
      AND a.STDJAM IS NOT NULL
      AND YEAR(a.DATE_TRANS) >= 2022
      AND DATENAME(dw, a.DATE_TRANS) IN ('Monday', 'Friday', 'Saturday')
      ${secFilter}
    GROUP BY YEAR(a.DATE_TRANS), DATENAME(dw, a.DATE_TRANS), a.STDJAM
    ORDER BY TAHUN DESC, HARI, JUMLAH DESC
  `);
  console.table(stdJamPerTahun);

  // -----------------------------------------------------------------------------
  // 2. INVESTIGASI IS1, IS2, IS3
  // -----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('2. INVESTIGASI IS1, IS2, IS3 (DISTRIBUSI & 500 BARIS RANDOM)');
  console.log('--------------------------------------------------------------------------------');

  const isStats = await query<any>(`
    SELECT 
      COUNT(*) AS TOTAL_BARIS_NON_SEC,
      SUM(CASE WHEN IS1 IS NOT NULL AND IS1 <> 0 THEN 1 ELSE 0 END) AS ROWS_WITH_IS1,
      SUM(CASE WHEN IS2 IS NOT NULL AND IS2 <> 0 THEN 1 ELSE 0 END) AS ROWS_WITH_IS2,
      SUM(CASE WHEN IS3 IS NOT NULL AND IS3 <> 0 THEN 1 ELSE 0 END) AS ROWS_WITH_IS3,
      SUM(CASE WHEN (IS1 IS NOT NULL AND IS1 <> 0) OR (IS2 IS NOT NULL AND IS2 <> 0) OR (IS3 IS NOT NULL AND IS3 <> 0) THEN 1 ELSE 0 END) AS ROWS_WITH_ANY_IS
    FROM TR_ABSEN a
    WHERE 1=1 ${secFilter}
  `);
  console.table(isStats);

  // Cek distribusi nilai IS1, IS2, IS3 yang pernah muncul
  console.log('\n--- Distribusi Nilai Unik IS1, IS2, IS3 ---');
  const isValues = await query<any>(`
    SELECT TOP 20
      IS1, IS2, IS3, STDJAM, JAM_KERJA, T_OT, STATUS_HARI,
      COUNT(*) AS FREKUENSI
    FROM TR_ABSEN a
    WHERE ((IS1 IS NOT NULL AND IS1 <> 0) OR (IS2 IS NOT NULL AND IS2 <> 0) OR (IS3 IS NOT NULL AND IS3 <> 0))
      ${secFilter}
    GROUP BY IS1, IS2, IS3, STDJAM, JAM_KERJA, T_OT, STATUS_HARI
    ORDER BY FREKUENSI DESC
  `);
  console.table(isValues);

  // Ambil 500 Sample Acak untuk diinspeksi mendalam
  console.log('\n--- Analisis Korelasi pada 500 Sample Acak dengan IS1/IS2/IS3 ---');
  const is500Sample = await query<any>(`
    SELECT TOP 500
      RTRIM(a.EMP_CD) AS EMP_CD,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      CONVERT(varchar(8), a.WORK_IN, 108) AS WORK_IN,
      CONVERT(varchar(8), a.WORK_OUT, 108) AS WORK_OUT,
      a.JAM_KERJA,
      a.STDJAM,
      a.IS1, a.IS2, a.IS3,
      a.T_OT, a.OT_1, a.OT_2,
      CONVERT(varchar(8), a.REST1_IN, 108) AS REST1_IN,
      CONVERT(varchar(8), a.REST1_OUT, 108) AS REST1_OUT
    FROM TR_ABSEN a
    WHERE ((IS1 IS NOT NULL AND IS1 <> 0) OR (IS2 IS NOT NULL AND IS2 <> 0) OR (IS3 IS NOT NULL AND IS3 <> 0))
      ${secFilter}
    ORDER BY CHECKSUM(NEWID())
  `);
  
  console.log(`Total sample ditarik: ${is500Sample.length} baris.`);
  console.log('Sample 10 baris pertama:');
  console.table(is500Sample.slice(0, 10));

  // -----------------------------------------------------------------------------
  // 3. UJI FORMULA OT_1, OT_2, OT_3, OT_4 VS T_OT PADA SELURUH DATA HISTORIS
  // -----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('3. UJI KECOCOKAN FORMULA DISTRIBUSI OT_1..OT_4 DARI T_OT (SELURUH DATA HISTORIS)');
  console.log('--------------------------------------------------------------------------------');

  // A. UJI HARI KERJA (STATUS_HARI = 'KERJA')
  console.log('\n--- A. HARI KERJA (STATUS_HARI = "KERJA" / "O") ---');
  const otKerjaMatch = await query<any>(`
    WITH EvalKerja AS (
      SELECT 
        a.T_OT,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        -- Expected Formulas
        CASE WHEN a.T_OT >= 1.0 THEN 1.0 ELSE CAST(a.T_OT AS NUMERIC(18,2)) END AS EXP_OT_1,
        CASE WHEN a.T_OT > 1.0 THEN CAST(a.T_OT - 1.0 AS NUMERIC(18,2)) ELSE 0.0 END AS EXP_OT_2,
        0.0 AS EXP_OT_3,
        0.0 AS EXP_OT_4
      FROM TR_ABSEN a
      WHERE a.T_OT > 0
        AND RTRIM(ISNULL(a.STATUS_HARI, 'KERJA')) IN ('KERJA', 'O')
        ${secFilter}
    )
    SELECT 
      COUNT(*) AS TOTAL_BARIS_OT_KERJA,
      SUM(CASE WHEN ISNULL(OT_1,0) = EXP_OT_1 AND ISNULL(OT_2,0) = EXP_OT_2 AND ISNULL(OT_3,0) = EXP_OT_3 AND ISNULL(OT_4,0) = EXP_OT_4 THEN 1 ELSE 0 END) AS MATCH_SEMPURNA,
      SUM(CASE WHEN ISNULL(OT_1,0) <> EXP_OT_1 OR ISNULL(OT_2,0) <> EXP_OT_2 OR ISNULL(OT_3,0) <> EXP_OT_3 OR ISNULL(OT_4,0) <> EXP_OT_4 THEN 1 ELSE 0 END) AS MISMATCH_COUNT,
      ROUND(SUM(CASE WHEN ISNULL(OT_1,0) = EXP_OT_1 AND ISNULL(OT_2,0) = EXP_OT_2 AND ISNULL(OT_3,0) = EXP_OT_3 AND ISNULL(OT_4,0) = EXP_OT_4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS PERSENTASE_MATCH
    FROM EvalKerja
  `);
  console.table(otKerjaMatch);

  // Jika ada mismatch pada hari kerja, tunjukkan 10 sampelnya
  const otKerjaMismatchSamples = await query<any>(`
    WITH EvalKerja AS (
      SELECT 
        RTRIM(a.EMP_CD) AS EMP_CD,
        CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
        RTRIM(a.STATUS_HARI) AS STATUS_HARI,
        a.T_OT,
        a.OT_1, a.OT_2, a.OT_3, a.OT_4,
        CASE WHEN a.T_OT >= 1.0 THEN 1.0 ELSE CAST(a.T_OT AS NUMERIC(18,2)) END AS EXP_OT_1,
        CASE WHEN a.T_OT > 1.0 THEN CAST(a.T_OT - 1.0 AS NUMERIC(18,2)) ELSE 0.0 END AS EXP_OT_2
      FROM TR_ABSEN a
      WHERE a.T_OT > 0
        AND RTRIM(ISNULL(a.STATUS_HARI, 'KERJA')) IN ('KERJA', 'O')
        ${secFilter}
    )
    SELECT TOP 10 * FROM EvalKerja
    WHERE ISNULL(OT_1,0) <> EXP_OT_1 OR ISNULL(OT_2,0) <> EXP_OT_2
    ORDER BY DATE_TRANS DESC
  `);
  if (otKerjaMismatchSamples.length > 0) {
    console.log('\nSample Mismatch Hari Kerja:');
    console.table(otKerjaMismatchSamples);
  }

  // B. UJI HARI LIBUR / OFF / H (STATUS_HARI IN ('LIBUR', 'OFF', 'H') ATAU WEEKEND)
  console.log('\n--- B. HARI LIBUR / OFF / HARI NASIONAL ---');
  const otLiburMatch = await query<any>(`
    WITH EvalLibur AS (
      SELECT 
        a.T_OT,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        0.0 AS EXP_OT_1,
        CASE WHEN a.T_OT > 8.0 THEN 8.0 ELSE CAST(a.T_OT AS NUMERIC(18,2)) END AS EXP_OT_2,
        CASE WHEN a.T_OT >= 9.0 THEN 1.0 ELSE 0.0 END AS EXP_OT_3,
        CASE WHEN a.T_OT >= 10.0 THEN CAST(a.T_OT - 9.0 AS NUMERIC(18,2)) ELSE 0.0 END AS EXP_OT_4
      FROM TR_ABSEN a
      WHERE a.T_OT > 0
        AND (RTRIM(a.STATUS_HARI) IN ('LIBUR', 'OFF', 'H') OR DATENAME(dw, a.DATE_TRANS) IN ('Saturday', 'Sunday'))
        ${secFilter}
    )
    SELECT 
      COUNT(*) AS TOTAL_BARIS_OT_LIBUR,
      SUM(CASE WHEN ISNULL(OT_1,0) = EXP_OT_1 AND ISNULL(OT_2,0) = EXP_OT_2 AND ISNULL(OT_3,0) = EXP_OT_3 AND ISNULL(OT_4,0) = EXP_OT_4 THEN 1 ELSE 0 END) AS MATCH_SEMPURNA,
      SUM(CASE WHEN ISNULL(OT_1,0) <> EXP_OT_1 OR ISNULL(OT_2,0) <> EXP_OT_2 OR ISNULL(OT_3,0) <> EXP_OT_3 OR ISNULL(OT_4,0) <> EXP_OT_4 THEN 1 ELSE 0 END) AS MISMATCH_COUNT,
      ROUND(SUM(CASE WHEN ISNULL(OT_1,0) = EXP_OT_1 AND ISNULL(OT_2,0) = EXP_OT_2 AND ISNULL(OT_3,0) = EXP_OT_3 AND ISNULL(OT_4,0) = EXP_OT_4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS PERSENTASE_MATCH
    FROM EvalLibur
  `);
  console.table(otLiburMatch);

  // Jika ada mismatch pada hari libur, tunjukkan 10 sampelnya
  const otLiburMismatchSamples = await query<any>(`
    WITH EvalLibur AS (
      SELECT 
        RTRIM(a.EMP_CD) AS EMP_CD,
        CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
        RTRIM(a.STATUS_HARI) AS STATUS_HARI,
        a.T_OT,
        a.OT_1, a.OT_2, a.OT_3, a.OT_4,
        0.0 AS EXP_OT_1,
        CASE WHEN a.T_OT > 8.0 THEN 8.0 ELSE CAST(a.T_OT AS NUMERIC(18,2)) END AS EXP_OT_2,
        CASE WHEN a.T_OT >= 9.0 THEN 1.0 ELSE 0.0 END AS EXP_OT_3,
        CASE WHEN a.T_OT >= 10.0 THEN CAST(a.T_OT - 9.0 AS NUMERIC(18,2)) ELSE 0.0 END AS EXP_OT_4
      FROM TR_ABSEN a
      WHERE a.T_OT > 0
        AND (RTRIM(a.STATUS_HARI) IN ('LIBUR', 'OFF', 'H') OR DATENAME(dw, a.DATE_TRANS) IN ('Saturday', 'Sunday'))
        ${secFilter}
    )
    SELECT TOP 10 * FROM EvalLibur
    WHERE ISNULL(OT_1,0) <> EXP_OT_1 OR ISNULL(OT_2,0) <> EXP_OT_2 OR ISNULL(OT_3,0) <> EXP_OT_3 OR ISNULL(OT_4,0) <> EXP_OT_4
    ORDER BY DATE_TRANS DESC
  `);
  if (otLiburMismatchSamples.length > 0) {
    console.log('\nSample Mismatch Hari Libur:');
    console.table(otLiburMismatchSamples);
  }
}

runInvestigation().then(() => process.exit(0)).catch(err => {
  console.error('Error saat investigasi:', err);
  process.exit(1);
});
