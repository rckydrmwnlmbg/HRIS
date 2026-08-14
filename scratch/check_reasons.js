require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function checkReasons() {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT REASON_CODE, REASON_DESC, REASON_GROUP 
      FROM Ms_Reason 
      WHERE RTRIM(REASON_GROUP) IN ('C', 'H')
      ORDER BY REASON_CODE
    `);
    console.log(result.recordset);
    sql.close();
  } catch (err) {
    console.error(err);
  }
}

checkReasons();
