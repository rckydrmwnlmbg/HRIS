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
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'TR_SPL'
    `);
    console.log("TR_SPL:", result.recordset.map(r => r.COLUMN_NAME).join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}
run();
