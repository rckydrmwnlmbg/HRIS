import { query } from '../lib/db';

async function findRecord() {
  const rows = await query<any>(`
    SELECT 
      RTRIM(a.EMP_CD) AS EMP_CD,
      RTRIM(a.EMP_NM) AS EMP_NM,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      CONVERT(varchar(19), a.WORK_IN1, 120) AS WORK_IN1,
      CONVERT(varchar(19), a.WORK_OUT1, 120) AS WORK_OUT1,
      CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
      CONVERT(varchar(19), a.DATE_IN, 120) AS DATE_IN,
      CONVERT(varchar(19), a.DATE_OUT, 120) AS DATE_OUT,
      a.JAM_KERJA,
      a.REASON
    FROM TR_ABSEN a
    WHERE CAST(a.WORK_IN1 AS TIME) = '06:50:33'
       OR CAST(a.WORK_OUT1 AS TIME) = '06:51:47'
       OR (DAY(a.DATE_TRANS) = 7 AND MONTH(a.DATE_TRANS) = 8)
  `);

  console.log(`Ditemukan ${rows.length} data:`);
  console.table(rows);
}

findRecord().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
