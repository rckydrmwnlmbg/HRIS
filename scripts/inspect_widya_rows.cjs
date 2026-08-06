const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;',
  driver: 'msnodesqlv8'
};

async function check() {
  const pool = await new sql.ConnectionPool(config).connect();
  const rows = await pool.request().query(`
    SELECT 
      CONVERT(varchar(10), a.DATE_TRANS, 120) as TANGGAL,
      DATENAME(weekday, a.DATE_TRANS) as HARI,
      a.WORK_IN, a.WORK_OUT, a.JAM_KERJA, a.STATUS_HARI, a.REASON,
      a.OT_1, a.OT_2, a.OT_3, a.OT_4, a.T_OT, a.Time_Late
    FROM TR_ABSEN a
    WHERE a.EMP_CD = '26066995' AND MONTH(a.DATE_TRANS) = 6 AND YEAR(a.DATE_TRANS) = 2026
    ORDER BY a.DATE_TRANS
  `);
  console.log('Rows in TR_ABSEN for 26066995 in June 2026:');
  console.log(JSON.stringify(rows.recordset, null, 2));

  process.exit(0);
}

check().catch(console.error);
