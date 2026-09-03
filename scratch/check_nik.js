const sql = require('mssql/msnodesqlv8');
const config = { connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;' };
async function test() {
  const pool = await sql.connect(config);
  const emp = await pool.request().query("SELECT EMP_CD, EMP_NM, SEC_CD, JOB_CD, DT_ENTRY, DT_RSG FROM EMP_TABLE WHERE RTRIM(EMP_CD) = '24063909'");
  console.log('EMP:', emp.recordset);
  const cur = await pool.request().query("SELECT CONVERT(varchar(10), DATE_TRANS, 120) as dt, WORK_IN, WORK_OUT, JAM_KERJA, STATUS_HARI, FLAG_ABSEN FROM TR_ABSEN WHERE RTRIM(EMP_CD) = '24063909' AND DATE_TRANS BETWEEN '2026-08-01' AND '2026-08-31' ORDER BY DATE_TRANS");
  console.log('Existing TR_ABSEN count:', cur.recordset.length);
  if (cur.recordset.length > 0) {
    console.table(cur.recordset.slice(0, 5));
  }
  await sql.close();
}
test().catch(console.error);
