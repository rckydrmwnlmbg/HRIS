import { query } from '../lib/db';

async function checkAhmadSecurity() {
  console.log('================================================================================');
  console.log('CEK DATA SECURITY AHMAD DI DATABASE');
  console.log('================================================================================\n');

  const emps = await query<any>(`
    SELECT 
      RTRIM(e.EMP_CD) AS EMP_CD,
      RTRIM(e.EMP_NM) AS EMP_NM,
      RTRIM(s.SEC_DESC) AS SEC_DESC,
      RTRIM(j.JOB_DESC) AS JOB_DESC,
      e.ALL_IN
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    WHERE e.EMP_NM LIKE '%AHMAD%' OR e.EMP_NM LIKE '%ACHMAD%'
  `);

  console.log('Karyawan Bernama Ahmad/Achmad:');
  console.table(emps);

  const securityAbsen = await query<any>(`
    SELECT TOP 10
      RTRIM(a.EMP_CD) AS EMP_CD,
      RTRIM(a.EMP_NM) AS EMP_NM,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
      CONVERT(varchar(8), a.JAM_MASUK, 108) AS JAM_MASUK,
      CONVERT(varchar(8), a.JAM_PULANG, 108) AS JAM_PULANG,
      a.JAM_KERJA,
      a.STDJAM,
      a.IS1,
      a.IS2,
      a.T_OT,
      a.OT_1,
      a.OT_2
    FROM TR_ABSEN a
    JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
    LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
    LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
    WHERE (UPPER(j.JOB_DESC) LIKE '%SECURITY%' OR UPPER(s.SEC_DESC) LIKE '%SECURITY%')
      AND (a.EMP_NM LIKE '%AHMAD%' OR a.EMP_NM LIKE '%ACHMAD%')
    ORDER BY a.DATE_TRANS DESC
  `);

  console.log('\nData Absensi Security Ahmad:');
  console.table(securityAbsen);
}

checkAhmadSecurity().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
