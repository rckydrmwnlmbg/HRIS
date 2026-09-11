const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;'
};

async function main() {
  try {
    const pool = await sql.connect(config);
    const res = await pool.request().query(`
      SELECT 
        RTRIM(a.EMP_CD) as EMP_CD,
        e.EMP_NM,
        e.FLAG_OT,
        e.ALL_IN,
        CONVERT(varchar(10), a.DATE_TRANS, 120) as dateStr,
        CONVERT(varchar(19), a.WORK_IN, 120) as WORK_IN,
        CONVERT(varchar(19), a.WORK_OUT, 120) as WORK_OUT,
        a.JAM_KERJA,
        a.STATUS_HARI,
        a.SHIFT,
        a.REASON,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        a.T_OT,
        a.OT_ACC,
        a.SPL,
        a.FLAG_OT as ABSEN_FLAG_OT
      FROM TR_ABSEN a WITH (NOLOCK)
      LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      WHERE CONVERT(varchar(10), a.DATE_TRANS, 120) = '2026-09-09'
        AND CONVERT(varchar(8), a.WORK_IN, 108) LIKE '06:56:%'
    `);
    console.log(JSON.stringify(res.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
