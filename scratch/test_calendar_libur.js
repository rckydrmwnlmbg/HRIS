const sql = require('mssql');
const config = {
  server: 'localhost',
  database: 'PayrollSys',
  user: 'sa',
  password: '53rV3r',
  options: { encrypt: false, trustServerCertificate: true }
};
async function run() {
  try {
    const pool = await sql.connect(config);
    const res = await pool.request().query(`
      SELECT DISTINCT 
        CONVERT(varchar(10), DATE_TRANS, 120) as tgl, 
        DATENAME(weekday, DATE_TRANS) as dayname, 
        STATUS_HARI 
      FROM TR_ABSEN 
      WHERE DATE_TRANS BETWEEN '2026-08-01' AND '2026-08-08' 
      ORDER BY tgl
    `);
    console.table(res.recordset);
    const libur = await pool.request().query(`
      SELECT CONVERT(varchar(10), TANGGAL, 120) as tgl, KETERANGAN 
      FROM MS_LIBUR_KERJA 
      WHERE TANGGAL BETWEEN '2026-08-01' AND '2026-08-31'
    `);
    console.log('MS_LIBUR_KERJA:', libur.recordset);
    await sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
