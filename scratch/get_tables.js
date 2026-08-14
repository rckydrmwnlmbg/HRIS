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

async function getTables() {
  try {
    await sql.connect(config);
    const res = await sql.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
    console.log(res.recordset.map(r => r.TABLE_NAME).join(', '));
    sql.close();
  } catch (err) {
    console.error(err);
  }
}

getTables();
