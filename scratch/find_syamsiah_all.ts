import { query } from '../lib/db';

async function findSyamsiahAbsen() {
  const rows = await query<any>(`
    SELECT TOP 10
      RTRIM(a.EMP_CD) AS EMP_CD,
      RTRIM(a.EMP_NM) AS EMP_NM,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      CONVERT(varchar(19), a.WORK_IN1, 120) AS RAW_IN,
      CONVERT(varchar(19), a.WORK_OUT1, 120) AS RAW_OUT,
      CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
      a.JAM_KERJA,
      a.STDJAM,
      a.IS1,
      a.T_OT,
      a.OT_1,
      a.OT_2
    FROM TR_ABSEN a
    WHERE a.EMP_NM LIKE '%SYAMSIYAH%' OR a.EMP_CD IN ('23053179', '24115147')
    ORDER BY a.DATE_TRANS DESC
  `);
  console.table(rows);
}

findSyamsiahAbsen().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
