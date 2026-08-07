import sql from 'mssql';

const config = {
  user: 'sa',
  password: 'Password123!',
  server: '192.168.1.189',
  database: 'TML_HRD',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 5000,
    requestTimeout: 10000,
  }
};

async function test() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to DB');

    // 1. Check max date in TR_ABSEN
    const maxDateRes = await pool.request().query(`SELECT MAX(DATE_TRANS) as MAX_DATE, MIN(DATE_TRANS) as MIN_DATE FROM TR_ABSEN`);
    console.log('Date range in TR_ABSEN:', maxDateRes.recordset[0]);

    // 2. Check late employees on recent date
    const maxDate = maxDateRes.recordset[0].MAX_DATE;
    const dateStr = maxDate ? maxDate.toISOString().slice(0, 10) : '2026-06-30';
    console.log('Testing date:', dateStr);

    const lateRes = await pool.request().query(`
      SELECT TOP 10
        RTRIM(e.EMP_CD) AS NIK,
        RTRIM(e.EMP_NM) AS NAMA,
        RTRIM(s.SEC_DESC) AS BAGIAN,
        RTRIM(j.JOB_DESC) AS JABATAN,
        CONVERT(varchar(5), a.WORK_IN, 108) AS JAM_MASUK,
        a.Time_Late AS MENIT_TERLAMBAT
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      WHERE CONVERT(varchar(10), a.DATE_TRANS, 120) = '${dateStr}'
        AND ISNULL(a.Time_Late, 0) > 0
      ORDER BY a.Time_Late DESC
    `);
    console.log('Late employees sample:', lateRes.recordset);

    const totalLateRes = await pool.request().query(`
      SELECT 
        COUNT(*) AS TOTAL_TERLAMBAT,
        AVG(a.Time_Late) AS AVG_TERLAMBAT,
        MAX(a.Time_Late) AS MAX_TERLAMBAT
      FROM TR_ABSEN a
      WHERE CONVERT(varchar(10), a.DATE_TRANS, 120) = '${dateStr}'
        AND ISNULL(a.Time_Late, 0) > 0
    `);
    console.log('Total late summary:', totalLateRes.recordset[0]);

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
