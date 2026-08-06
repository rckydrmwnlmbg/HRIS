import { query } from '../lib/db';

async function checkRawTap26066995() {
  const res = await query<any>(`
    SELECT 
      a.EMP_CD,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      a.STATUS_HARI,
      a.REASON,
      CONVERT(varchar(19), a.WORK_IN1, 120) AS RAW_WORK_IN1,
      CONVERT(varchar(19), a.WORK_OUT1, 120) AS RAW_WORK_OUT1,
      CONVERT(varchar(19), a.WORK_IN, 120) AS CURRENT_WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) AS CURRENT_WORK_OUT
    FROM TR_ABSEN a
    WHERE RTRIM(a.EMP_CD) = '26066995'
      AND a.DATE_TRANS >= '2026-07-01' AND a.DATE_TRANS <= '2026-07-15'
    ORDER BY a.DATE_TRANS
  `);
  console.table(res);
}

checkRawTap26066995().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
