import { query } from '../lib/db';

async function runFullOfficeDataVerification() {
  console.log('========================================================================');
  console.log('HASIL RE-VERIFIKASI DATA FORENSIK LENGKAP (SQL SERVER LIVE)');
  console.log('========================================================================');

  // 1. Host & Server Context
  const serverInfo = await query<any>(`
    SELECT 
      @@SERVERNAME AS SERVER_NAME,
      DB_NAME() AS DATABASE_NAME,
      SUSER_SNAME() AS USER_LOGIN,
      (SELECT COUNT(*) FROM EMP_TABLE) AS TOTAL_KARYAWAN,
      (SELECT COUNT(*) FROM TR_ABSEN) AS TOTAL_RECORD_ABSEN
  `);
  console.log('\n1. KONEKSI & KONTEKS SERVER:');
  console.table(serverInfo);

  // 2. tbldetcuti & tblCUTI
  const cutiStats = await query<any>(`
    SELECT 
      (SELECT COUNT(*) FROM tblCUTI) AS COUNT_TBLCUTI,
      (SELECT COUNT(*) FROM tbldetcuti) AS COUNT_TBLDETCUTI
  `);
  console.log('\n2. STATUS TABEL CUTI (tbldetcuti vs tblCUTI):');
  console.table(cutiStats);

  // 3. MS_LIBUR_KERJA Content
  const liburCount = await query<any>(`SELECT COUNT(*) AS TOTAL_HARI_LIBUR FROM MS_LIBUR_KERJA`);
  console.log('\n3. STATUS TABEL MS_LIBUR_KERJA:');
  console.table(liburCount);

  if (liburCount[0].TOTAL_HARI_LIBUR > 0) {
    const liburSample = await query<any>(`SELECT TOP 10 * FROM MS_LIBUR_KERJA ORDER BY TANGGAL DESC`);
    console.table(liburSample);
  } else {
    console.log('⚠️ Tabel MS_LIBUR_KERJA kosong (0 records) pada database saat ini.');
  }

  // 4. Scan Data Tahun Masa Depan (>2027) & Tahun Kuno (1899/1900)
  const corruptScan = await query<any>(`
    SELECT 
      SUM(CASE WHEN YEAR(WORK_IN) > 2027 OR YEAR(WORK_OUT) > 2027 THEN 1 ELSE 0 END) AS FUTURE_YEAR_ALL_TIME,
      SUM(CASE WHEN (YEAR(WORK_IN) > 2027 OR YEAR(WORK_OUT) > 2027) AND DATE_TRANS >= '2026-07-01' THEN 1 ELSE 0 END) AS FUTURE_YEAR_JULY_2026,
      SUM(CASE WHEN YEAR(WORK_IN) IN (1899, 1900) OR YEAR(WORK_OUT) IN (1899, 1900) THEN 1 ELSE 0 END) AS ANCIENT_YEAR_1899_1900_ALL_TIME,
      SUM(CASE WHEN (YEAR(WORK_IN) IN (1899, 1900) OR YEAR(WORK_OUT) IN (1899, 1900)) AND DATE_TRANS >= '2026-07-01' THEN 1 ELSE 0 END) AS ANCIENT_YEAR_JULY_2026,
      SUM(CASE WHEN YEAR(WORK_IN) = 2026 AND YEAR(WORK_OUT) = 2026 AND DATE_TRANS >= '2026-07-01' THEN 1 ELSE 0 END) AS VALID_2026_JULY_ROWS
    FROM TR_ABSEN
  `);
  console.log('\n4. SCAN INTEGRITAS TAHUN KERJA (Tahun Masa Depan & Kuno):');
  console.table(corruptScan);

  // 5. Sample OT_1 / OT_2 / T_OT untuk baris-baris yang sempat terdampak
  const sampleOT = await query<any>(`
    SELECT 
      RTRIM(a.EMP_CD) AS EMP_CD,
      RTRIM(e.EMP_NM) AS EMP_NM,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      RTRIM(ISNULL(e.ALL_IN, '0')) AS ALL_IN,
      CONVERT(varchar(8), a.WORK_IN, 108) AS WORK_IN,
      CONVERT(varchar(8), a.WORK_OUT, 108) AS WORK_OUT,
      a.JAM_KERJA,
      a.OT_1, a.OT_2, a.T_OT
    FROM TR_ABSEN a
    JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
    WHERE RTRIM(a.EMP_CD) IN ('26066995', '13042349', '13050002', '13050205', '13050458', '24115262')
      AND a.DATE_TRANS >= '2026-07-01' AND a.DATE_TRANS <= '2026-07-04'
    ORDER BY a.EMP_CD, a.DATE_TRANS
  `);
  console.log('\n5. SAMPLE BARIS TERDAMPAK (OT_1, OT_2, T_OT, JAM_KERJA):');
  console.table(sampleOT);
}

runFullOfficeDataVerification().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
