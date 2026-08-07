import { query } from '../lib/db';

async function checkOtHours() {
  console.log('================================================================================');
  console.log('CEK HUBUNGAN JAM PULANG VS T_OT DI DATABASE AKTUAL');
  console.log('================================================================================\n');

  const rows = await query<any>(`
    SELECT 
      DATEPART(HOUR, a.WORK_OUT1) AS PULANG_JAM,
      CASE 
        WHEN DATEPART(MINUTE, a.WORK_OUT1) < 30 THEN '00-29 mnt' 
        ELSE '30-59 mnt' 
      END AS PULANG_MENIT,
      COUNT(*) AS JUMLAH_DATA,
      AVG(a.JAM_KERJA) AS AVG_JAM_KERJA,
      AVG(a.IS1) AS AVG_IS1,
      AVG(a.IS2) AS AVG_IS2,
      AVG(a.T_OT) AS AVG_T_OT,
      MIN(a.T_OT) AS MIN_T_OT,
      MAX(a.T_OT) AS MAX_T_OT
    FROM TR_ABSEN a
    JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
    WHERE a.STATUS_HARI = 'KERJA'
      AND UPPER(ISNULL(RTRIM(e.ALL_IN),'0')) NOT IN ('1', 'Y', 'TRUE')
      AND a.WORK_OUT1 IS NOT NULL
      AND DATEPART(HOUR, a.WORK_OUT1) >= 16 AND DATEPART(HOUR, a.WORK_OUT1) <= 22
    GROUP BY 
      DATEPART(HOUR, a.WORK_OUT1),
      CASE 
        WHEN DATEPART(MINUTE, a.WORK_OUT1) < 30 THEN '00-29 mnt' 
        ELSE '30-59 mnt' 
      END
    ORDER BY PULANG_JAM ASC, PULANG_MENIT ASC
  `);

  console.table(rows);
}

checkOtHours().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
