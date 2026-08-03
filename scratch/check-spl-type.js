const sql = require('mssql/msnodesqlv8');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const config = {
  server: '.\\SQLEXPRESS',
  database: process.env.DB_NAME || 'hris_widy',
  driver: 'ODBC Driver 18 for SQL Server',
  options: {
    trustedConnection: true,
    encrypt: false,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT TABLE_NAME, TABLE_TYPE 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'TR_SPL'
    `);
    console.log(result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}
run();
