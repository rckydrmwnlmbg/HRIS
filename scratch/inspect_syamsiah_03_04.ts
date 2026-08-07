import { query } from '../lib/db';

async function inspectSyamsiah() {
  console.log('================================================================================');
  console.log('INSPECT SYAMSIAH (23053179 / 24115147) TANGGAL 03 & 04 AGUSTUS 2026');
  console.log('================================================================================\n');

  const rows = await query<any>(`
    SELECT 
      RTRIM(a.EMP_CD) AS EMP_CD,
      RTRIM(a.EMP_NM) AS EMP_NM,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      CONVERT(varchar(19), a.WORK_IN1, 120) AS RAW_IN,
      CONVERT(varchar(19), a.WORK_OUT1, 120) AS RAW_OUT,
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
    WHERE (a.EMP_NM LIKE '%SYAMSIYAH%' OR a.EMP_CD IN ('23053179', '24115147'))
      AND a.DATE_TRANS >= '2026-08-01' AND a.DATE_TRANS <= '2026-08-07'
    ORDER BY a.EMP_CD, a.DATE_TRANS
  `);

  console.table(rows);
}

inspectSyamsiah().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
