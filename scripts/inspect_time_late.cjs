const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;',
  driver: 'msnodesqlv8'
};

async function checkLateDetails() {
  const pool = await new sql.ConnectionPool(config).connect();
  const res = await pool.request().query(`
    SELECT TOP 30
      RTRIM(EMP_CD) AS EMP_CD,
      CONVERT(varchar(10), DATE_TRANS, 120) AS DATE_TRANS,
      CONVERT(varchar(8), JAM_MASUK, 108) AS JAM_MASUK,
      CONVERT(varchar(8), WORK_IN, 108) AS WORK_IN,
      DATEDIFF(MINUTE, JAM_MASUK, WORK_IN) AS RAW_MINUTES,
      Time_Late,
      POT_JAM
    FROM TR_ABSEN
    WHERE Time_Late > 0 AND WORK_IN > JAM_MASUK
    ORDER BY DATE_TRANS DESC, Time_Late ASC
  `);
  console.table(res.recordset);
  await pool.close();
}

checkLateDetails().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
