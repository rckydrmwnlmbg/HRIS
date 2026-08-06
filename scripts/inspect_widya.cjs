const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;',
  driver: 'msnodesqlv8'
};

async function check() {
  const pool = await new sql.ConnectionPool(config).connect();
  const emps = await pool.request().query(`
    SELECT EMP_CD, EMP_NM, BS_SLR, JNS_KRY, SEC_CD, JOB_CD, ALL_IN, Act_NonAct, DT_RSG
    FROM EMP_TABLE 
    WHERE EMP_NM LIKE '%ETIKA%' OR EMP_NM LIKE '%WIDYA%'
  `);
  console.log('Employees found:', emps.recordset);

  process.exit(0);
}

check().catch(console.error);
