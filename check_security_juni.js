const sql = require('mssql/msnodesqlv8');

async function test() {
  const config = {
    connectionString: 'Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;',
  };

  const pool = await sql.connect(config);
  
  // 1. Employee Info
  const empInfo = await pool.request().query(`
    SELECT RTRIM(e.EMP_CD) AS EMP_CD, RTRIM(e.EMP_NM) AS EMP_NM, RTRIM(e.SX) AS SX, 
           RTRIM(s.SEC_DESC) AS SEC_DESC, RTRIM(j.JOB_DESC) AS JOB_DESC
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
    LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
    WHERE RTRIM(e.EMP_CD) = '26046707'
  `);

  console.log('Employee Info:', empInfo.recordset[0]);

  // 2. Attendance in June 2026
  const attendance = await pool.request().query(`
    SELECT 
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
      DATENAME(dw, a.DATE_TRANS) AS HARI,
      RTRIM(a.SHIFT) AS SHIFT,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      RTRIM(a.REASON) AS REASON,
      CONVERT(varchar(8), a.JAM_MASUK, 108) AS SCH_IN,
      CONVERT(varchar(8), a.JAM_PULANG, 108) AS SCH_OUT,
      CONVERT(varchar(8), a.WORK_IN1, 108) AS WORK_IN1,
      CONVERT(varchar(8), a.WORK_OUT1, 108) AS WORK_OUT1,
      CONVERT(varchar(8), a.WORK_IN, 108) AS WORK_IN,
      CONVERT(varchar(8), a.WORK_OUT, 108) AS WORK_OUT,
      CONVERT(varchar(8), a.FINGER_IN, 108) AS FINGER_IN,
      CONVERT(varchar(8), a.FINGER_OUT, 108) AS FINGER_OUT,
      a.OT_1, a.OT_2, a.OT_3, a.OT_4, a.T_OT, a.JAM_KERJA
    FROM TR_ABSEN a
    WHERE RTRIM(a.EMP_CD) = '26046707'
      AND MONTH(a.DATE_TRANS) = 6 AND YEAR(a.DATE_TRANS) = 2026
    ORDER BY a.DATE_TRANS ASC
  `);

  console.log('\nTotal Records in June 2026:', attendance.recordset.length);
  console.log(JSON.stringify(attendance.recordset, null, 2));

  process.exit(0);
}

test();
