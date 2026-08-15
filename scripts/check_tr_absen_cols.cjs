const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;',
  driver: 'msnodesqlv8'
};

async function checkCols() {
  const pool = await new sql.ConnectionPool(config).connect();
  const cols = await pool.request().query(`
    SELECT 
      COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'TR_ABSEN'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(JSON.stringify(cols.recordset, null, 2));
  await pool.close();
}

checkCols().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
