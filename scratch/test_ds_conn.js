const sql = require('mssql');

async function test() {
  const config = {
    server: '192.168.0.4',
    database: 'DataSolution',
    user: 'hris_tmnb',
    password: '111777TP',
    requestTimeout: 20000,
    options: { encrypt: false, trustServerCertificate: true }
  };
  console.log('Connecting to DataSolution via Cloudflare WARP (192.168.0.4)...');
  try {
    const pool = await sql.connect(config);
    console.log('Connected successfully!');
    const q = "SELECT COUNT(*) as total FROM CHECKINOUT WHERE CHECKTIME >= '2026-09-11' AND CHECKTIME < '2026-09-12'";
    const res = await pool.request().query(q);
    console.log('Total tap data for 11 September 2026:', res.recordset[0].total);
    await pool.close();
  } catch (err) {
    console.error('Query failed:', err.message, 'Code:', err.code);
  }
}

test();
