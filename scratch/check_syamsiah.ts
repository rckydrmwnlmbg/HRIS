import { query } from '../lib/db';

async function checkSyamsiah() {
  console.log('================================================================================');
  console.log('CEK DATA SYAMSIAH PADA TANGGAL 04 AGUSTUS');
  console.log('================================================================================\n');

  const emp = await query<any>(`
    SELECT 
      RTRIM(e.EMP_CD) AS EMP_CD,
      RTRIM(e.EMP_NM) AS EMP_NM,
      RTRIM(e.SEC_CD) AS SEC_CD,
      RTRIM(s.SEC_DESC) AS SEC_DESC,
      RTRIM(j.JOB_DESC) AS JOB_DESC,
      e.ALL_IN
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    WHERE e.EMP_NM LIKE '%SYAMSIAH%'
  `);

  console.log('Data Karyawan Syamsiah:');
  console.table(emp);

  if (emp.length > 0) {
    for (const em of emp) {
      const absen = await query<any>(`
        SELECT 
          CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
          RTRIM(a.STATUS_HARI) AS STATUS_HARI,
          CONVERT(varchar(19), a.WORK_IN1, 120) AS RAW_IN,
          CONVERT(varchar(19), a.WORK_OUT1, 120) AS RAW_OUT,
          CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
          CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
          a.JAM_KERJA,
          a.STDJAM,
          a.IS1,
          a.IS2,
          a.IS3,
          a.T_OT,
          a.OT_1,
          a.OT_2,
          a.OT_3,
          a.OT_4
        FROM TR_ABSEN a
        WHERE RTRIM(a.EMP_CD) = '${em.EMP_CD}'
          AND a.DATE_TRANS >= '2026-08-01' AND a.DATE_TRANS <= '2026-08-07'
        ORDER BY a.DATE_TRANS ASC
      `);
      console.log(`\nData Absensi NIK ${em.EMP_CD} (${em.EMP_NM}):`);
      console.table(absen);
    }
  }
}

checkSyamsiah().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
