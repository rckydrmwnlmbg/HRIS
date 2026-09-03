const sql = require('mssql');

const config = {
  user: 'sa',
  password: '53rV3r',
  server: 'localhost',
  database: 'PayrollSys',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'SQLEXPRESS'
  }
};

async function main() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected. Checking blocking sessions...');
    const res = await pool.request().query(`
      SELECT 
        r.session_id,
        r.blocking_session_id,
        r.wait_type,
        r.wait_time,
        r.status,
        t.text as query_text
      FROM sys.dm_exec_requests r
      CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
    `);
    console.table(res.recordset);

    const openTran = await pool.request().query(`
      SELECT 
        s.session_id,
        s.login_name,
        s.host_name,
        s.program_name,
        s.status,
        t.open_tran_count
      FROM sys.dm_exec_sessions s
      JOIN sys.dm_tran_session_transactions t ON s.session_id = t.session_id
    `);
    console.log('Open Transactions:');
    console.table(openTran.recordset);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    try { await sql.close(); } catch(e){}
  }
  process.exit(0);
}

main();
