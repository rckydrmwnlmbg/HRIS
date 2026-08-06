import { query } from '../lib/db';

async function auditDatabase() {
  console.log('========================================================================');
  console.log('📊 FORENSIC AUDIT DATABASE HRIS WIDY');
  console.log('========================================================================\n');

  // Poin 2: Check OT_1, OT_2, OT_3, OT_4, T_OT for specific impacted employees (26066995, 13042349, 13050002, 13050205, 13050458, 24115262)
  console.log('=== POIN 2: STATUS OT_1, OT_2, T_OT EMPLOYEES YANG SEMPAT TERDAMPAK ===');
  const p2Res = await query<any>(`
    SELECT 
      RTRIM(a.EMP_CD) AS EMP_CD,
      RTRIM(e.EMP_NM) AS EMP_NM,
      RTRIM(e.ALL_IN) AS ALL_IN,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      a.STATUS_HARI,
      CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
      a.OT_1, a.OT_2, a.OT_3, a.OT_4, a.T_OT, a.JAM_KERJA
    FROM TR_ABSEN a
    LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
    WHERE RTRIM(a.EMP_CD) IN ('26066995', '13042349', '13050002', '13050205', '13050458', '24115262')
      AND a.DATE_TRANS >= '2026-07-01' AND a.DATE_TRANS <= '2026-07-15'
    ORDER BY a.EMP_CD, a.DATE_TRANS
  `);
  console.log(`Total baris sample diperiksa: ${p2Res.length}`);
  console.table(p2Res.slice(0, 20).map(r => ({
    EMP_CD: r.EMP_CD,
    DATE: r.DATE_TRANS,
    ALL_IN: r.ALL_IN,
    WORK_IN: r.WORK_IN ? r.WORK_IN.substring(11, 19) : null,
    WORK_OUT: r.WORK_OUT ? r.WORK_OUT.substring(11, 19) : null,
    OT_1: r.OT_1,
    OT_2: r.OT_2,
    T_OT: r.T_OT,
    JAM_KERJA: r.JAM_KERJA
  })));

  // Poin 5 & 6: Query agregat WORK_OUT landing zone accuracy
  console.log('\n=== POIN 5 & 6: AGREGAT WORK_OUT LANDING ZONE ACCURACY (JULI 2026) ===');
  const p5Res = await query<any>(`
    SELECT 
      COUNT(*) AS TOTAL_WORK_ROWS,
      SUM(CASE WHEN DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME), a.WORK_OUT) % 60 BETWEEN 0 AND 14 THEN 1 ELSE 0 END) AS IN_ZONE_0_14,
      SUM(CASE WHEN DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME), a.WORK_OUT) % 60 > 14 THEN 1 ELSE 0 END) AS OUTSIDE_ZONE_15_59,
      SUM(CASE WHEN DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME), a.WORK_OUT) < 0 THEN 1 ELSE 0 END) AS PULANG_CEPAT
    FROM TR_ABSEN a
    JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    WHERE a.DATE_TRANS >= '2026-07-01' AND a.DATE_TRANS <= '2026-07-31'
      AND a.STATUS_HARI = 'KERJA'
      AND a.WORK_OUT IS NOT NULL
      AND a.JAM_PULANG IS NOT NULL
      AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
      AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
  `);
  console.table(p5Res);

  // Poin 12: tbldetcuti count in database
  console.log('\n=== POIN 12: JUMLAH ROW tbldetcuti DI DATABASE ===');
  try {
    const p12Res = await query<any>(`SELECT COUNT(*) AS TOTAL_DETCUTI FROM tbldetcuti`);
    console.table(p12Res);
    const p12Sample = await query<any>(`SELECT TOP 5 * FROM tbldetcuti ORDER BY DT_CUTI DESC`);
    console.log('Sample tbldetcuti:');
    console.table(p12Sample);
  } catch (e: any) {
    console.log('Error querying tbldetcuti:', e.message);
  }

  // Poin 13: Cek Kasus NIK 26066995 (7-10 Juli) & CHECKINOUT
  console.log('\n=== POIN 13: KASUS NIK 26066995 (7-10 JULI 2026) & CHECKINOUT ===');
  const p13Absen = await query<any>(`
    SELECT 
      a.EMP_CD, CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      a.STATUS_HARI, a.REASON, mr.REASON_DESC,
      CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
      a.OT_1, a.OT_2, a.T_OT, a.JAM_KERJA
    FROM TR_ABSEN a
    LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
    WHERE RTRIM(a.EMP_CD) = '26066995'
      AND a.DATE_TRANS >= '2026-07-05' AND a.DATE_TRANS <= '2026-07-15'
    ORDER BY a.DATE_TRANS
  `);
  console.table(p13Absen);

  try {
    const p13Checkin = await query<any>(`
      SELECT TOP 20 
        USERID, CHECKTIME, CHECKTYPE, SENSORID
      FROM CHECKINOUT
      WHERE USERID IN (
        SELECT USERID FROM USERINFO WHERE RTRIM(Badgenumber) = '26066995' OR RTRIM(SSN) = '26066995'
      )
      AND CHECKTIME >= '2026-07-01' AND CHECKTIME <= '2026-07-15'
      ORDER BY CHECKTIME
    `);
    console.log('CHECKINOUT raw tap records for 26066995:');
    console.table(p13Checkin);
  } catch (e: any) {
    console.log('Error querying CHECKINOUT:', e.message);
  }

  // Poin 17: MS_LIBUR_KERJA structure & sample
  console.log('\n=== POIN 17: STRUKTUR & ISI TABEL MS_LIBUR_KERJA ===');
  try {
    const p17Cols = await query<any>(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MS_LIBUR_KERJA'
    `);
    console.log('Kolom MS_LIBUR_KERJA:');
    console.table(p17Cols);

    const p17Sample = await query<any>(`SELECT TOP 10 * FROM MS_LIBUR_KERJA ORDER BY 1 DESC`);
    console.log('Sample data MS_LIBUR_KERJA:');
    console.table(p17Sample);
  } catch (e: any) {
    console.log('Error querying MS_LIBUR_KERJA:', e.message);
  }

  // Poin 18 & 20: Sisa data tahun rusak (>2027, 1899/1900)
  console.log('\n=== POIN 18 & 20: DATA RUSAK MASA DEPAN (>2027) & 1899/1900 (SELURUH TR_ABSEN) ===');
  const p18Res = await query<any>(`
    SELECT 
      SUM(CASE WHEN YEAR(WORK_IN) > 2027 OR YEAR(WORK_OUT) > 2027 THEN 1 ELSE 0 END) AS FUTURE_YEAR_COUNT_ALL_TIME,
      SUM(CASE WHEN (YEAR(WORK_IN) > 2027 OR YEAR(WORK_OUT) > 2027) AND DATE_TRANS >= '2026-07-01' THEN 1 ELSE 0 END) AS FUTURE_YEAR_JULY_2026,
      SUM(CASE WHEN YEAR(WORK_IN) IN (1899, 1900) OR YEAR(WORK_OUT) IN (1899, 1900) THEN 1 ELSE 0 END) AS ANCIENT_YEAR_1899_1900,
      SUM(CASE WHEN YEAR(WORK_IN) = 2026 AND YEAR(WORK_OUT) = 2026 AND DATE_TRANS >= '2026-07-01' THEN 1 ELSE 0 END) AS VALID_2026_JULY
    FROM TR_ABSEN
  `);
  console.table(p18Res);

  // Poin 21: Keberadaan tabel TR_AUDIT_ABSEN
  console.log('\n=== POIN 21: STATUS KEBERADAAN TABEL TR_AUDIT_ABSEN ===');
  const p21Res = await query<any>(`
    SELECT TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME = 'TR_AUDIT_ABSEN'
  `);
  console.table(p21Res);
}

auditDatabase().then(() => process.exit(0)).catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
