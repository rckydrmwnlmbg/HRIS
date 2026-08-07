import { query } from '../lib/db';

async function inspectJum07() {
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
    WHERE a.DATE_TRANS = '2026-08-07'
      AND a.WORK_IN1 IS NOT NULL
  `);

  console.log(`Ditemukan ${rows.length} data pada 2026-08-07:`);
  console.table(rows);
}

inspectJum07().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
