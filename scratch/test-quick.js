const sql = require('mssql/msnodesqlv8');
const config = { 
  connectionString: 'Driver={SQL Server};Server=localhost\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;',
  connectionTimeout: 5000,
  requestTimeout: 5000
};
async function test() {
  console.log('Connecting with localhost\\SQLEXPRESS...');
  const pool = await sql.connect(config);
  console.log('Connected!');
  const res = await pool.request().query("SELECT TOP 3 EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, OT_1, OT_2 FROM TR_ABSEN WHERE DATE_TRANS >= '2026-09-01' AND WORK_IN IS NOT NULL");
  console.log(res.recordset);
  await sql.close();
}
test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
