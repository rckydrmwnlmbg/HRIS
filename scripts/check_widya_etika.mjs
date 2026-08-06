import { getDbConnection } from './lib/db.js';

async function check() {
  const pool = await getDbConnection();

  console.log('=== 1. SEARCH EMP_TABLE FOR WIDYA ===');
  const emps = await pool.request().query(`
    SELECT 
      RTRIM(e.EMP_CD) AS EMP_CD, 
      RTRIM(e.EMP_NM) AS EMP_NM, 
      e.BS_SLR, 
      RTRIM(e.SEC_CD) AS SEC_CD, 
      RTRIM(s.SEC_DESC) AS SEC_DESC,
      RTRIM(j.JOB_DESC) AS JOB_DESC,
      e.Act_NonAct, 
      e.DT_ENTRY, 
      e.DT_RSG,
      RTRIM(e.ALL_IN) AS ALL_IN,
      RTRIM(e.STATUS) AS STATUS
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
    LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
    WHERE e.EMP_NM LIKE '%WIDYA%' OR e.EMP_NM LIKE '%ETIKA%' OR e.EMP_CD LIKE '%13050130%'
  `);
  console.log(emps.recordset);

  console.log('=== 2. CHECK ALL TABLES WITH SALARY / GAJI IN NAME ===');
  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'
  `);
  console.log('Tables:', tables.recordset.map(t => t.TABLE_NAME));

  if (emps.recordset.length > 0) {
    const nik = emps.recordset[0].EMP_CD;
    console.log(`=== 3. CHECK TR_ABSEN FOR ${nik} IN JUNE 2026 ===`);
    const absen = await pool.request().query(`
      SELECT 
        CONVERT(varchar(10), DATE_TRANS, 120) AS DATE_TRANS,
        WORK_IN, WORK_OUT, JAM_KERJA, STATUS_HARI, REASON,
        OT_1, OT_2, OT_3, OT_4, T_OT, U_MAKAN, U_TRANSPORT
      FROM TR_ABSEN
      WHERE EMP_CD = '${nik}' AND MONTH(DATE_TRANS) = 6 AND YEAR(DATE_TRANS) = 2026
      ORDER BY DATE_TRANS
    `);
    console.log(`Found ${absen.recordset.length} rows in TR_ABSEN:`);
    console.log(absen.recordset);

    console.log(`=== 4. SUMMARY TR_ABSEN FOR ${nik} IN JUNE 2026 ===`);
    const sum = await pool.request().query(`
      SELECT 
        COUNT(WORK_IN) AS TOTAL_HADIR,
        SUM(ISNULL(OT_1,0)) AS SUM_OT1,
        SUM(ISNULL(OT_2,0)) AS SUM_OT2,
        SUM(ISNULL(OT_3,0)) AS SUM_OT3,
        SUM(ISNULL(OT_4,0)) AS SUM_OT4,
        SUM(ISNULL(T_OT,0)) AS SUM_TOT_OT,
        SUM(ISNULL(U_MAKAN,0)) AS SUM_U_MAKAN,
        SUM(ISNULL(U_TRANSPORT,0)) AS SUM_U_TRANSPORT
      FROM TR_ABSEN
      WHERE EMP_CD = '${nik}' AND MONTH(DATE_TRANS) = 6 AND YEAR(DATE_TRANS) = 2026
    `);
    console.log(sum.recordset[0]);
  }
}

check().catch(console.error);
