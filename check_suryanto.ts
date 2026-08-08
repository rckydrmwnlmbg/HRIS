import { getDbConnection } from './lib/db';
import { calculateAttendanceAndOt } from './lib/otCalculator';
import { detectSecurityShift } from './lib/securitySchedule';

async function checkSuryantoJuni() {
  const pool = await getDbConnection();
  const request = pool.request();
  
  const result = await request.query(\
    SELECT
      CONVERT(varchar(10), a.DATE_TRANS, 120) as DATE_TRANS,
      RTRIM(a.SHIFT) AS DB_SHIFT,
      a.STATUS_HARI AS DB_STATUS,
      CONVERT(varchar(19), a.WORK_IN, 120) as WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) as WORK_OUT,
      a.JAM_KERJA AS DB_JAM_KERJA,
      a.OT_1, a.OT_2, a.OT_3, a.OT_4, a.T_OT,
      RTRIM(e.JOB_CD) AS JOB_CD,
      RTRIM(j.JOB_DESC) AS JOB_DESC,
      RTRIM(s.SEC_DESC) AS SEC_DESC
    FROM TR_ABSEN a
    JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
    LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
    LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
    WHERE a.EMP_CD = '26056812'
      AND MONTH(a.DATE_TRANS) = 6
      AND YEAR(a.DATE_TRANS) = 2026
    ORDER BY a.DATE_TRANS ASC
  \);

  const rows = result.recordset;
  console.log('Total baris:', rows.length);

  for (let r of rows) {
    const wIn = r.WORK_IN ? new Date(r.WORK_IN) : null;
    let wOut = r.WORK_OUT ? new Date(r.WORK_OUT) : null;

    if (wIn && wOut && wOut <= wIn) {
        const inferred = (wOut.getHours() * 60 + wOut.getMinutes()) + 1440 - (wIn.getHours() * 60 + wIn.getMinutes());
        if (wIn.getHours() >= 14 && inferred >= 4*60 && inferred <= 16*60) {
            wOut.setDate(wOut.getDate() + 1);
        }
    }

    const calcResult = calculateAttendanceAndOt(
      r.DATE_TRANS,
      wIn,
      wOut,
      r.JOB_DESC,
      r.SEC_DESC,
      r.DB_STATUS,
      r.DB_SHIFT
    );
    
    const detected = detectSecurityShift(r.WORK_IN, r.WORK_OUT);

    console.log(\\\n--- TANGGAL: \ ---\);
    console.log(\FINGERPRINT: IN: \ | OUT: \\);
    console.log(\DATABASE LAMA:\);
    console.log(\   SHIFT      : \\);
    console.log(\   STATUS_HARI: \\);
    console.log(\   JAM_KERJA  : \\);
    console.log(\   OT TIER    : O1:\ O2:\ O3:\ O4:\ (Total:\)\);
    
    console.log(\SETELAH KOREKSI (Logika Baru):\);
    console.log(\   DETECT_SHF : \\);
    console.log(\   STATUS_HARI: \\);
    console.log(\   JAM_KERJA  : \\);
    console.log(\   OT TIER    : O1:\ O2:\ O3:\ O4:\ (Total:\)\);
  }

  process.exit(0);
}

checkSuryantoJuni();
