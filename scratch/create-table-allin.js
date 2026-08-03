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
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TR_LEMBUR_ALLIN' and xtype='U')
      CREATE TABLE TR_LEMBUR_ALLIN (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          DATE_TRANS DATE NOT NULL,
          EMP_CD VARCHAR(20) NOT NULL,
          JAM_MULAI VARCHAR(5) NOT NULL,
          JAM_SELESAI VARCHAR(5) NOT NULL,
          NOMINAL DECIMAL(18, 2) NOT NULL,
          CREATED_AT DATETIME DEFAULT GETDATE(),
          CREATED_BY VARCHAR(50)
      );
    `);
    console.log('Table TR_LEMBUR_ALLIN created successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}
run();
