import { query } from '../lib/db';

async function check2030Cases() {
  console.log('================================================================================');
  console.log('CEK KASUS AKTUAL KARYAWAN PULANG JAM 20:30 DI DATABASE SQL SERVER');
  console.log('================================================================================\n');

  const rows = await query<any>(`
    SELECT TOP 20
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
      a.IS2,
      a.IS3,
      a.T_OT,
      a.OT_1,
      a.OT_2,
      a.OT_3,
      a.OT_4
    FROM TR_ABSEN a
    JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
    WHERE a.STATUS_HARI = 'KERJA'
      AND UPPER(ISNULL(RTRIM(e.ALL_IN),'0')) NOT IN ('1', 'Y', 'TRUE')
      AND (
        (CAST(a.WORK_OUT AS TIME) >= '20:30:00' AND CAST(a.WORK_OUT AS TIME) <= '20:45:00')
        OR (CAST(a.WORK_OUT1 AS TIME) >= '20:30:00' AND CAST(a.WORK_OUT1 AS TIME) <= '20:45:00')
      )
    ORDER BY a.DATE_TRANS DESC
  `);

  console.log(`Ditemukan ${rows.length} contoh kasus pulang ~20:30:`);
  console.table(rows);
}

check2030Cases().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
