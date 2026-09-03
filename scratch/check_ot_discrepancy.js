const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;'
};

async function main() {
  try {
    const pool = await sql.connect(config);
    const res = await pool.request().query(`
      SELECT 
        CONVERT(varchar(10), a.DATE_TRANS, 120) as dateStr,
        a.EMP_CD,
        e.EMP_NM,
        s.SEC_DESC,
        CONVERT(varchar(19), a.WORK_IN, 120) as WORK_IN,
        CONVERT(varchar(19), a.WORK_OUT, 120) as WORK_OUT,
        CONVERT(varchar(19), a.JAM_MASUK, 120) as JAM_MASUK,
        CONVERT(varchar(19), a.JAM_PULANG, 120) as JAM_PULANG,
        a.JAM_KERJA,
        a.STATUS_HARI,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        (ISNULL(a.OT_1,0)+ISNULL(a.OT_2,0)+ISNULL(a.OT_3,0)+ISNULL(a.OT_4,0)) as TOTAL_OT_DB
      FROM TR_ABSEN a
      LEFT JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
      WHERE a.DATE_TRANS >= '2026-08-24' AND a.DATE_TRANS <= '2026-08-30'
        AND a.EMP_CD IN ('25066012', '24125665', '24094817', '24115155')
      ORDER BY a.DATE_TRANS, a.EMP_CD
    `);
    console.table(res.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    try { await sql.close(); } catch(e){}
  }
  process.exit(0);
}

main();
