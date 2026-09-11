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
        e.FLAG_OT as EMP_FLAG_OT,
        e.ALL_IN,
        e.SEC_CD,
        e.JOB_CD,
        CONVERT(varchar(10), a.DATE_TRANS, 120) as dateStr,
        CONVERT(varchar(19), a.WORK_IN, 120) as WORK_IN,
        CONVERT(varchar(19), a.WORK_OUT, 120) as WORK_OUT,
        CONVERT(varchar(19), a.JAM_MASUK, 120) as JAM_MASUK,
        CONVERT(varchar(19), a.JAM_PULANG, 120) as JAM_PULANG,
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
    console.log('--- RECORD 2026-09-09 ---');
    console.log(JSON.stringify(res.recordset, null, 2));

    if (res.recordset.length > 0) {
      const empCd = res.recordset[0].EMP_CD;
      const septRows = await pool.request().query(`
        SELECT 
          CONVERT(varchar(10), a.DATE_TRANS, 120) as dateStr,
          CONVERT(varchar(8), a.WORK_IN, 108) as win,
          CONVERT(varchar(8), a.WORK_OUT, 108) as wout,
          a.SHIFT,
          a.STATUS_HARI,
          a.REASON,
          a.SPL,
          a.OT_ACC,
          a.OT_1,
          a.OT_2,
          a.OT_3,
          a.OT_4,
          a.T_OT,
          a.FLAG_OT as ABSEN_FLAG_OT
        FROM TR_ABSEN a WITH (NOLOCK)
        WHERE RTRIM(a.EMP_CD) = '${empCd}'
          AND a.DATE_TRANS >= '2026-09-01' AND a.DATE_TRANS <= '2026-09-10'
        ORDER BY a.DATE_TRANS
      `);
      console.log('--- ALL SEPT ROWS FOR ' + empCd + ' ---');
      console.table(septRows.recordset);
    }
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
