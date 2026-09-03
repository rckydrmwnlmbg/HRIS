const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;'
};

async function main() {
  console.log('Connecting to SQLEXPRESS PayrollSys...');
  try {
    const pool = await sql.connect(config);
    const nik = '24063909';
    const res = await pool.request().query(`
      SELECT 
        CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
        RTRIM(a.SHIFT) AS SHIFT,
        RTRIM(a.EMP_CD) AS EMP_CD,
        RTRIM(a.EMP_NM) AS EMP_NM,
        a.JAM_KERJA,
        RTRIM(a.STATUS_HARI) AS STATUS_HARI,
        a.OT_1, a.OT_2, a.OT_3, a.OT_4
      FROM TR_ABSEN a
      WHERE RTRIM(a.EMP_CD) = '${nik}'
        AND MONTH(a.DATE_TRANS) = 8
        AND YEAR(a.DATE_TRANS) = 2026
      ORDER BY a.DATE_TRANS ASC
    `);
    console.log('Result count for Siti Misroh (24063909) in Aug 2026:', res.recordset.length);
    if (res.recordset.length > 0) {
      console.table(res.recordset.slice(0, 5));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    try { await sql.close(); } catch(e){}
  }
}

main();
