import { query } from '../lib/db';

async function testOtBreakdown() {
  console.log('================================================================================');
  console.log('3. UJI FORMULA DISTRIBUSI OT_1..OT_4 DARI T_OT (SELURUH DATA HISTORIS)');
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

  // -----------------------------------------------------------------------------
  // A. UJI HARI KERJA (STATUS_HARI = 'KERJA' / 'O')
  // -----------------------------------------------------------------------------
  console.log('--- A. HARI KERJA (STATUS_HARI = "KERJA" / "O") ---');
  const otKerjaMatch = await query<any>(`
    WITH EvalKerja AS (
      SELECT 
        a.T_OT,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        -- Expected Formulas:
        -- OT_1 = min(T_OT, 1.0)
        -- OT_2 = max(T_OT - 1.0, 0.0)
        -- OT_3 = 0.0
        -- OT_4 = 0.0
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

  // Mismatch samples if any
  const otKerjaMismatchSamples = await query<any>(`
    SELECT TOP 10
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
      AND (
        ISNULL(OT_1,0) <> (CASE WHEN a.T_OT >= 1.0 THEN 1.0 ELSE CAST(a.T_OT AS NUMERIC(18,2)) END)
        OR ISNULL(OT_2,0) <> (CASE WHEN a.T_OT > 1.0 THEN CAST(a.T_OT - 1.0 AS NUMERIC(18,2)) ELSE 0.0 END)
        OR ISNULL(OT_3,0) <> 0
        OR ISNULL(OT_4,0) <> 0
      )
      ${secFilter}
    ORDER BY DATE_TRANS DESC
  `);
  if (otKerjaMismatchSamples.length > 0) {
    console.log('\nSample Mismatch Hari Kerja:');
    console.table(otKerjaMismatchSamples);
  } else {
    console.log('✅ Hari Kerja: 100% MATCH SEMPURNA!');
  }

  // -----------------------------------------------------------------------------
  // B. UJI HARI LIBUR / OFF / H (STATUS_HARI IN ('LIBUR', 'OFF', 'H') ATAU WEEKEND)
  // -----------------------------------------------------------------------------
  console.log('\n--- B. HARI LIBUR / OFF / HARI NASIONAL (STATUS_HARI IN ("LIBUR", "OFF", "H") ATAU WEEKEND) ---');
  
  // Mari cek distribusi OT_1, OT_2, OT_3, OT_4 vs T_OT di Hari Libur
  const liburDistribution = await query<any>(`
    SELECT TOP 20
      a.T_OT, a.OT_1, a.OT_2, a.OT_3, a.OT_4, COUNT(*) AS FREKUENSI
    FROM TR_ABSEN a
    WHERE a.T_OT > 0
      AND (RTRIM(a.STATUS_HARI) IN ('LIBUR', 'OFF', 'H') OR DATENAME(dw, a.DATE_TRANS) IN ('Saturday', 'Sunday'))
      ${secFilter}
    GROUP BY a.T_OT, a.OT_1, a.OT_2, a.OT_3, a.OT_4
    ORDER BY FREKUENSI DESC
  `);
  console.log('Top 20 Pola Lembur Hari Libur di Database:');
  console.table(liburDistribution);

  const otLiburMatch = await query<any>(`
    WITH EvalLibur AS (
      SELECT 
        a.T_OT,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        -- Aturan Libur INUS:
        -- OT_1 = 0
        -- OT_2 = min(T_OT, 8.0)
        -- OT_3 = min(max(T_OT - 8.0, 0.0), 1.0)
        -- OT_4 = max(T_OT - 9.0, 0.0)
        0.0 AS EXP_OT_1,
        CASE WHEN a.T_OT > 8.0 THEN 8.0 ELSE CAST(a.T_OT AS NUMERIC(18,2)) END AS EXP_OT_2,
        CASE WHEN a.T_OT > 8.0 THEN (CASE WHEN a.T_OT >= 9.0 THEN 1.0 ELSE CAST(a.T_OT - 8.0 AS NUMERIC(18,2)) END) ELSE 0.0 END AS EXP_OT_3,
        CASE WHEN a.T_OT > 9.0 THEN CAST(a.T_OT - 9.0 AS NUMERIC(18,2)) ELSE 0.0 END AS EXP_OT_4
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
        CASE WHEN a.T_OT > 8.0 THEN (CASE WHEN a.T_OT >= 9.0 THEN 1.0 ELSE CAST(a.T_OT - 8.0 AS NUMERIC(18,2)) END) ELSE 0.0 END AS EXP_OT_3,
        CASE WHEN a.T_OT > 9.0 THEN CAST(a.T_OT - 9.0 AS NUMERIC(18,2)) ELSE 0.0 END AS EXP_OT_4
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
  } else {
    console.log('✅ Hari Libur: 100% MATCH SEMPURNA!');
  }
}

testOtBreakdown().then(() => process.exit(0)).catch(err => {
  console.error('Error saat uji OT breakdown:', err);
  process.exit(1);
});
