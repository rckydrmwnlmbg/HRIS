const sql = require('mssql/msnodesqlv8');

async function checkAllAugusts() {
  const config = {
    connectionString: 'Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;'
  };
  try {
    const pool = await sql.connect(config);
    
    // Check all records on August 1st across all years
    const resAug1 = await pool.request().query(`
      SELECT 
        CONVERT(varchar(10), DATE_TRANS, 120) as dt,
        DATENAME(dw, DATE_TRANS) as dw,
        COUNT(*) as cnt,
        SUM(CASE WHEN WORK_IN IS NOT NULL THEN 1 ELSE 0 END) as withWorkIn,
        SUM(CASE WHEN STATUS_HARI = 'KERJA' THEN 1 ELSE 0 END) as countKerja,
        SUM(CASE WHEN STATUS_HARI = 'LIBUR' THEN 1 ELSE 0 END) as countLibur,
        AVG(CAST(OT_1 as float)) as avgOt1,
        AVG(CAST(OT_2 as float)) as avgOt2,
        AVG(CAST(T_OT as float)) as avgTot,
        AVG(CAST(JAM_KERJA as float)) as avgJamKerja
      FROM TR_ABSEN
      WHERE MONTH(DATE_TRANS) = 8 AND DAY(DATE_TRANS) <= 7
      GROUP BY DATE_TRANS
      ORDER BY DATE_TRANS DESC
    `);
    console.log('--- All August 1-7 in TR_ABSEN ---');
    console.table(resAug1.recordset);

    // Also check TR_ABSENEDIT or TR_AUDIT_ABSEN or tblKoreksiAbsen to see recent edits
    const resAudit = await pool.request().query(`
      SELECT TOP 20 *
      FROM sys.tables
      WHERE name LIKE '%AUDIT%' OR name LIKE '%LOG%' OR name LIKE '%KOREKSI%' OR name LIKE '%EDIT%'
    `);
    console.log('--- Audit/Edit tables ---');
    console.table(resAudit.recordset);

    await pool.close();
  } catch (err) {
    console.error(err);
  }
}

checkAllAugusts();
