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
        CONVERT(varchar(10), a.DATE_TRANS, 120) as dateStr,
        CONVERT(varchar(19), a.WORK_IN, 120) as WORK_IN,
        CONVERT(varchar(19), a.WORK_OUT, 120) as WORK_OUT,
        a.JAM_KERJA,
        a.STATUS_HARI,
        a.SHIFT,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        a.T_OT,
        (ISNULL(a.OT_1, 0) + ISNULL(a.OT_2, 0) + ISNULL(a.OT_3, 0) + ISNULL(a.OT_4, 0)) AS dailyOt
      FROM TR_ABSEN a WITH (NOLOCK)
      WHERE RTRIM(a.EMP_CD) IN ('13113725', '13073027')
        AND a.DATE_TRANS >= '2026-08-31' AND a.DATE_TRANS <= '2026-09-05'
      ORDER BY a.EMP_CD, a.DATE_TRANS
    `);
    console.log(JSON.stringify(res.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
